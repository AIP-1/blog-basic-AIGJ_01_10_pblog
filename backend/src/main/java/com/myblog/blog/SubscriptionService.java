package com.myblog.blog;

import com.myblog.common.KoreanClock;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.post.PostQueryService;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 구독: 블로그 전체(모든 공개 다이어리) 또는 다이어리 한 권을 구독하면 그 새 공개 글이 '구독' 화면에 모인다.
 * 탈퇴 신청한 회원은 세지 않는다. 내 블로그·내 다이어리·비공개 다이어리는 구독할 수 없다.
 */
@Service
public class SubscriptionService {
    /** 다이어리(categories 별칭 c)의 구독자 수. 다른 클래스에서도 다이어리 목록에 붙여 쓴다. */
    public static final String DIARY_SUBSCRIBERS = """
            (SELECT count(*) FROM diary_subscriptions ds JOIN members dm ON dm.id = ds.member_id
             WHERE ds.category_id = c.id AND dm.deleted_at IS NULL)""";

    /** :viewer가 다이어리(categories 별칭 c)의 구독자인지: 그 블로그나 그 다이어리를 구독했다 */
    public static final String SUBSCRIBED_TO_DIARY = """
            (c.blog_id IN (SELECT vs.blog_id FROM subscriptions vs WHERE vs.member_id = :viewer)
             OR c.id IN (SELECT vd.category_id FROM diary_subscriptions vd WHERE vd.member_id = :viewer))""";

    record DiaryOwner(long ownerId, long blogId, String visibility) {}

    private final JdbcClient jdbc;
    private final BlogService blogs;
    private final KoreanClock clock;

    public SubscriptionService(JdbcClient jdbc, BlogService blogs, KoreanClock clock) {
        this.jdbc = jdbc;
        this.blogs = blogs;
        this.clock = clock;
    }

    public long subscriberCount(long blogId) {
        return jdbc.sql("""
                SELECT count(*) FROM subscriptions s JOIN members m ON m.id = s.member_id
                WHERE s.blog_id = ? AND m.deleted_at IS NULL""").param(blogId).query(Long.class).single();
    }

    public boolean subscribedBy(long blogId, Long memberId) {
        return memberId != null && jdbc.sql("SELECT count(*) FROM subscriptions WHERE blog_id = ? AND member_id = ?")
                .params(blogId, memberId).query(Long.class).single() > 0;
    }

    /** 누르면 구독, 다시 누르면 취소. 내 블로그는 불가. */
    @Transactional
    public Map<String, Object> toggle(long blogId, long memberId) {
        var blog = blogs.get(blogId);
        if (blog.ownerId() == memberId) {
            throw new ApiException(ErrorCode.OWN_BLOG);
        }
        int removed = jdbc.sql("DELETE FROM subscriptions WHERE blog_id = ? AND member_id = ?")
                .params(blogId, memberId).update();
        if (removed == 0) {
            jdbc.sql("INSERT INTO subscriptions (member_id, blog_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
                    .params(memberId, blogId, clock.nowOffset()).update();
        }
        return Map.of("subscribed", removed == 0, "subscriberCount", subscriberCount(blogId));
    }

    /** 내가 구독한 블로그: 최근에 구독한 것부터. 마지막 글 시각은 내가 볼 수 있는 글(구독자만 글 포함) 기준. */
    public List<Map<String, Object>> mine(long memberId) {
        return jdbc.sql("""
                SELECT b.id, b.name, m.nickname AS owner_nickname,
                       (SELECT max(p.created_at) FROM posts p WHERE p.blog_id = b.id AND\s"""
                        + PostQueryService.VISIBLE_TO + """
                ) AS last_post_at
                FROM subscriptions s JOIN blogs b ON b.id = s.blog_id JOIN members m ON m.id = b.owner_id
                WHERE s.member_id = :viewer AND m.deleted_at IS NULL
                ORDER BY s.created_at DESC, b.id DESC""")
                .param("viewer", memberId)
                .query((rs, i) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("id"));
                    row.put("name", rs.getString("name"));
                    row.put("ownerNickname", rs.getString("owner_nickname"));
                    row.put("lastPostAt", rs.getObject("last_post_at", OffsetDateTime.class));
                    return row;
                }).list();
    }

    /**
     * 다이어리 구독: 누르면 구독, 다시 누르면 취소. 내 다이어리와 비공개 다이어리는 안 되고,
     * 구독자만 다이어리는 그 블로그를 구독한 사람만 된다.
     */
    @Transactional
    public Map<String, Object> toggleDiary(long categoryId, long memberId) {
        DiaryOwner diary = jdbc.sql("""
                SELECT b.owner_id, c.blog_id, c.visibility
                FROM categories c JOIN blogs b ON b.id = c.blog_id JOIN members m ON m.id = b.owner_id
                WHERE c.id = ? AND m.deleted_at IS NULL""")
                .param(categoryId).query(DiaryOwner.class).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
        if (diary.ownerId() == memberId) {
            throw new ApiException(ErrorCode.OWN_DIARY);
        }
        if ("PRIVATE".equals(diary.visibility())) {
            throw new ApiException(ErrorCode.PRIVATE_DIARY);
        }
        int removed = jdbc.sql("DELETE FROM diary_subscriptions WHERE category_id = ? AND member_id = ?")
                .params(categoryId, memberId).update();
        // 구독자만 다이어리는 그 블로그를 구독한 사람만 구독할 수 있다 (구독 취소는 언제나 된다)
        if (removed == 0 && "SUBSCRIBERS".equals(diary.visibility()) && !subscribedBy(diary.blogId(), memberId)) {
            throw new ApiException(ErrorCode.SUBSCRIBERS_ONLY_DIARY);
        }
        if (removed == 0) {
            jdbc.sql("""
                    INSERT INTO diary_subscriptions (member_id, category_id, created_at) VALUES (?, ?, ?)
                    ON CONFLICT DO NOTHING""").params(memberId, categoryId, clock.nowOffset()).update();
        }
        long count = jdbc.sql("SELECT " + DIARY_SUBSCRIBERS + " FROM categories c WHERE c.id = ?")
                .param(categoryId).query(Long.class).single();
        return Map.of("subscribed", removed == 0, "subscriberCount", count);
    }

    /** 내가 구독한 다이어리: 최근에 구독한 것부터. 글 수는 내가 볼 수 있는 글(구독자만 글 포함)만 센다. */
    public List<Map<String, Object>> mineDiaries(long memberId) {
        return jdbc.sql("""
                SELECT c.id, c.name, c.color_index, b.id AS blog_id, b.name AS blog_name,
                       (SELECT count(*) FROM posts p WHERE p.category_id = c.id AND\s"""
                        + PostQueryService.VISIBLE_TO + """
                ) AS post_count
                FROM diary_subscriptions s JOIN categories c ON c.id = s.category_id
                JOIN blogs b ON b.id = c.blog_id JOIN members m ON m.id = b.owner_id
                WHERE s.member_id = :viewer AND m.deleted_at IS NULL AND c.visibility <> 'PRIVATE'
                ORDER BY s.created_at DESC, c.id DESC""")
                .param("viewer", memberId)
                .query((rs, i) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("id"));
                    row.put("name", rs.getString("name"));
                    row.put("colorIndex", rs.getInt("color_index"));
                    row.put("blog", Map.of("id", rs.getLong("blog_id"), "name", rs.getString("blog_name")));
                    row.put("postCount", rs.getLong("post_count"));
                    return row;
                }).list();
    }
}
