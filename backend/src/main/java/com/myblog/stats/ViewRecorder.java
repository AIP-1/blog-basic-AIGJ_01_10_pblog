package com.myblog.stats;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.RedisGuard;
import com.myblog.post.PostQueryService.PostRow;
import com.myblog.search.TrendingService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * 글 상세를 열 때 조회수와 방문자를 센다 (BM-06-3, 4, 7, research §9).
 * 같은 사람이 30분 안에 다시 열면 조회수를 세지 않고, 블로그 방문자는 하루(한국 시간) 한 번만 센다.
 * 블로그 주인 본인과 비공개 글은 세지 않는다. Redis가 꺼져 있으면 기록을 건너뛴다.
 */
@Component
public class ViewRecorder {
    private final StringRedisTemplate redis;
    private final RedisGuard guard;
    private final JdbcClient jdbc;
    private final KoreanClock clock;
    private final MyBlogProperties props;
    private final TrendingService trending;

    public ViewRecorder(StringRedisTemplate redis, RedisGuard guard, JdbcClient jdbc, KoreanClock clock,
                        MyBlogProperties props, TrendingService trending) {
        this.redis = redis;
        this.guard = guard;
        this.jdbc = jdbc;
        this.clock = clock;
        this.props = props;
        this.trending = trending;
    }

    public static String visitorKey(Long memberId, String vid) {
        return memberId != null ? "m:" + memberId : "v:" + vid;
    }

    public void record(PostRow post, Long viewerId, String vid) {
        // 비공개 글은 세지 않는다. 구독자만 글은 구독자가 본 것을 센다.
        if ("PRIVATE".equals(post.visibility()) || (viewerId != null && viewerId == post.authorId())) {
            return;
        }
        if (viewerId == null && vid == null) {
            return;
        }
        String who = visitorKey(viewerId, vid);
        boolean newView = guard.optional(() -> redis.opsForValue()
                .setIfAbsent("view:post:" + post.id() + ":" + who, "1", props.views().dedup())).orElse(false);
        if (!newView) {
            return;
        }
        var today = clock.today();
        boolean newVisitor = guard.optional(() -> redis.opsForValue()
                .setIfAbsent("visit:" + post.blogId() + ":" + who + ":" + today, "1", clock.untilMidnight()))
                .orElse(false);
        jdbc.sql("UPDATE posts SET view_count = view_count + 1 WHERE id = ?").param(post.id()).update();
        upsert(post.blogId(), post.id(), today, 1, 0);
        upsert(post.blogId(), null, today, 1, newVisitor ? 1 : 0);
        trending.recordView(post.id());
    }

    private void upsert(long blogId, Long postId, java.time.LocalDate date, int views, int visitors) {
        jdbc.sql("""
                INSERT INTO daily_stats (blog_id, post_id, stat_date, views, visitors) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (blog_id, post_id, stat_date)
                DO UPDATE SET views = daily_stats.views + EXCLUDED.views, visitors = daily_stats.visitors + EXCLUDED.visitors""")
                .params(blogId, postId, date, views, visitors).update();
    }
}
