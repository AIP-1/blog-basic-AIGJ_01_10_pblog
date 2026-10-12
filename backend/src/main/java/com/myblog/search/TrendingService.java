package com.myblog.search;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.post.PostQueryService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 실시간 인기 검색어 (요구사항.md 3.8, research §8).
 * 최근 24시간 점수 = 검색 수×3 + 그 검색어가 제목에 들어간 공개 글의 조회 수×1 + 댓글 수×5.
 * 5초마다 다시 계산해 메모리에 둔다(서버 1대).
 */
@Service
public class TrendingService {
    public record Item(int rank, String keyword, String change, int delta) {}

    public record Snapshot(OffsetDateTime updatedAt, List<Item> items) {}

    private record View(Instant at, long postId) {}

    private final JdbcClient jdbc;
    private final MyBlogProperties.Trending rules;
    private final KoreanClock clock;
    private final ConcurrentLinkedDeque<View> recentViews = new ConcurrentLinkedDeque<>();
    private final AtomicReference<Snapshot> current;
    private Map<String, Integer> previousRanks = Map.of();

    public TrendingService(JdbcClient jdbc, MyBlogProperties props, KoreanClock clock) {
        this.jdbc = jdbc;
        this.rules = props.trending();
        this.clock = clock;
        this.current = new AtomicReference<>(new Snapshot(clock.nowOffset(), List.of()));
    }

    /** 공개 글 조회를 기록한다 (ViewRecorder가 부른다). */
    public void recordView(long postId) {
        recentViews.addLast(new View(clock.now(), postId));
    }

    public Snapshot current() {
        return current.get();
    }

    @Scheduled(fixedRateString = "${myblog.trending.interval}")
    public synchronized void refresh() {
        Instant now = clock.now();
        Instant since = now.minus(rules.window());
        while (!recentViews.isEmpty() && recentViews.peekFirst().at().isBefore(since)) {
            recentViews.pollFirst();
        }
        OffsetDateTime sinceOffset = OffsetDateTime.ofInstant(since, KoreanClock.SEOUL);
        Map<String, Long> searches = new HashMap<>();
        jdbc.sql("SELECT keyword, count(*) AS c FROM search_logs WHERE searched_at >= ? GROUP BY keyword")
                .param(sinceOffset).query((rs, i) -> searches.put(rs.getString("keyword"), rs.getLong("c"))).list();

        Map<Long, Long> viewsByPost = new HashMap<>();
        recentViews.forEach(v -> viewsByPost.merge(v.postId(), 1L, Long::sum));
        Map<Long, String> titles = new HashMap<>();
        if (!viewsByPost.isEmpty()) {
            jdbc.sql("SELECT p.id, lower(p.title) AS t FROM posts p WHERE " + PostQueryService.PUBLIC_ONLY
                            + " AND p.id IN (:ids)")
                    .param("ids", viewsByPost.keySet())
                    .query((rs, i) -> titles.put(rs.getLong("id"), rs.getString("t"))).list();
        }
        List<String[]> commented = jdbc.sql("""
                SELECT lower(p.title) AS t FROM comments cm JOIN posts p ON p.id = cm.post_id
                WHERE cm.created_at >= ? AND\s""" + PostQueryService.PUBLIC_ONLY)
                .param(sinceOffset)
                .query((rs, i) -> new String[] {rs.getString("t")}).list();

        Map<String, Long> scores = new HashMap<>();
        for (var e : searches.entrySet()) {
            String kw = e.getKey();
            String[] words = kw.split(" ");
            long views = 0;
            for (var t : titles.entrySet()) {
                if (containsAll(t.getValue(), words)) {
                    views += viewsByPost.getOrDefault(t.getKey(), 0L);
                }
            }
            long comments = commented.stream().filter(c -> containsAll(c[0], words)).count();
            scores.put(kw, e.getValue() * rules.searchWeight() + views * rules.viewWeight()
                    + comments * rules.commentWeight());
        }
        List<String> ranked = scores.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(rules.size()).map(Map.Entry::getKey).toList();

        List<Item> items = new ArrayList<>();
        Map<String, Integer> ranks = new LinkedHashMap<>();
        for (int i = 0; i < ranked.size(); i++) {
            String kw = ranked.get(i);
            int rank = i + 1;
            ranks.put(kw, rank);
            Integer before = previousRanks.get(kw);
            String change;
            int delta = 0;
            if (before == null) {
                change = "NEW";
            } else if (before > rank) {
                change = "UP";
                delta = before - rank;
            } else if (before < rank) {
                change = "DOWN";
                delta = rank - before;
            } else {
                change = "SAME";
            }
            items.add(new Item(rank, kw, change, delta));
        }
        previousRanks = ranks;
        current.set(new Snapshot(clock.nowOffset(), List.copyOf(items)));
    }

    private static boolean containsAll(String text, String[] words) {
        for (String w : words) {
            if (!text.contains(w)) {
                return false;
            }
        }
        return true;
    }

}
