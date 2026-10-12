package com.myblog.shop;

import com.myblog.common.KoreanClock;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 도전과제. 진행도는 따로 쌓지 않고 기존 기록에서 그때그때 센다.
 * 목표를 채우면 '받기'로 보상(잉크, 한정 스티커)을 한 번만 받는다.
 */
@Service
public class ChallengeService {
    private record ChallengeRow(String code, String title, String description, int goal, int rewardInk,
                                String rewardSticker, String rewardStickerName) {}

    private final JdbcClient jdbc;
    private final InkService ink;
    private final StickerService stickers;
    private final KoreanClock clock;

    public ChallengeService(JdbcClient jdbc, InkService ink, StickerService stickers, KoreanClock clock) {
        this.jdbc = jdbc;
        this.ink = ink;
        this.stickers = stickers;
        this.clock = clock;
    }

    private static final String SELECT = """
            SELECT c.code, c.title, c.description, c.goal, c.reward_ink, c.reward_sticker,
                   s.name AS reward_sticker_name
            FROM challenges c LEFT JOIN stickers s ON s.code = c.reward_sticker
            """;

    private long count(String sql, Object... params) {
        return jdbc.sql(sql).params(params).query(Long.class).single();
    }

    /** 도전과제 코드별 지금 값 */
    long progress(String code, long memberId) {
        return switch (code) {
            case "first-post", "posts-10" -> count("SELECT count(*) FROM posts WHERE author_id = ?", memberId);
            case "comments-10" -> count("""
                    SELECT count(*) FROM comments c JOIN posts p ON p.id = c.post_id
                    WHERE c.author_id = ? AND p.author_id <> ?""", memberId, memberId);
            case "likes-50" -> count("""
                    SELECT count(*) FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = ?""", memberId);
            case "diaries-3" -> count("""
                    SELECT count(*) FROM categories c JOIN blogs b ON b.id = c.blog_id
                    WHERE b.owner_id = ? AND NOT c.is_default""", memberId);
            // 블로그 구독이나 다이어리 구독 중 하나라도
            case "first-subscribe" -> count("""
                    SELECT (SELECT count(*) FROM subscriptions WHERE member_id = ?)
                         + (SELECT count(*) FROM diary_subscriptions WHERE member_id = ?)""", memberId, memberId);
            case "first-bookmark" -> count("SELECT count(*) FROM bookmarks WHERE member_id = ?", memberId);
            case "bio" -> count("SELECT count(*) FROM members WHERE id = ? AND bio <> ''", memberId);
            case "streak-7" -> ink.longestStreak(memberId);
            case "checkin-30" -> count("SELECT count(*) FROM ink_ledger_entries WHERE member_id = ? AND reason = 'CHECKIN'",
                    memberId);
            default -> 0;
        };
    }

    private Map<String, Object> view(ChallengeRow c, Long memberId, Set<String> claimed) {
        long value = memberId == null ? 0 : Math.min(progress(c.code(), memberId), c.goal());
        boolean done = value >= c.goal();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", c.code());
        m.put("title", c.title());
        m.put("description", c.description());
        m.put("goal", c.goal());
        m.put("progress", value);
        m.put("rewardInk", c.rewardInk());
        m.put("rewardSticker", c.rewardSticker() == null ? null
                : Map.of("code", c.rewardSticker(), "name", c.rewardStickerName(), "limited", true));
        m.put("completed", done);
        m.put("claimed", claimed.contains(c.code()));
        return m;
    }

    /** 목록. 로그인 안 했으면 진행도 0으로 보여 준다 */
    public List<Map<String, Object>> list(Long memberId) {
        Set<String> claimed = new HashSet<>(memberId == null ? List.of()
                : jdbc.sql("SELECT challenge_code FROM member_challenges WHERE member_id = ?").param(memberId)
                        .query(String.class).list());
        return jdbc.sql(SELECT + " ORDER BY c.sort_order").query(ChallengeRow.class).list().stream()
                .map(c -> view(c, memberId, claimed)).toList();
    }

    /** 보상 받기: 목표를 채웠고 아직 안 받았을 때만. 받은 기록(기본 키)을 먼저 넣어 두 번 받지 못하게 한다 */
    @Transactional
    public Map<String, Object> claim(long memberId, String code) {
        ChallengeRow c = jdbc.sql(SELECT + " WHERE c.code = ?").param(code).query(ChallengeRow.class).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.CHALLENGE_NOT_FOUND));
        if (progress(code, memberId) < c.goal()) {
            throw new ApiException(ErrorCode.CHALLENGE_NOT_DONE);
        }
        int inserted = jdbc.sql("""
                INSERT INTO member_challenges (member_id, challenge_code, claimed_at) VALUES (?, ?, ?)
                ON CONFLICT DO NOTHING""").params(memberId, code, clock.nowOffset()).update();
        if (inserted == 0) {
            throw new ApiException(ErrorCode.ALREADY_CLAIMED);
        }
        int earned = ink.credit(memberId, c.rewardInk(), InkService.CHALLENGE, code, 0);
        if (c.rewardSticker() != null) {
            stickers.give(memberId, c.rewardSticker());
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("earned", earned);
        m.put("sticker", c.rewardSticker() == null ? null : Map.of("code", c.rewardSticker(), "name", c.rewardStickerName()));
        m.put("balance", ink.balance(memberId));
        return m;
    }
}
