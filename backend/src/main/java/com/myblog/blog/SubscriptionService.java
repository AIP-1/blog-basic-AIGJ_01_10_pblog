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

/** 구독: 블로그를 구독하면 그 블로그의 새 공개 글이 '구독' 화면에 모인다. 탈퇴 신청한 회원은 세지 않는다. */
@Service
public class SubscriptionService {
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

    /** 내가 구독한 블로그: 최근에 구독한 것부터. 마지막 글 시각은 공개 글 기준. */
    public List<Map<String, Object>> mine(long memberId) {
        return jdbc.sql("""
                SELECT b.id, b.name, m.nickname AS owner_nickname,
                       (SELECT max(p.created_at) FROM posts p WHERE p.blog_id = b.id AND\s"""
                        + PostQueryService.PUBLIC_ONLY + """
                ) AS last_post_at
                FROM subscriptions s JOIN blogs b ON b.id = s.blog_id JOIN members m ON m.id = b.owner_id
                WHERE s.member_id = ? AND m.deleted_at IS NULL
                ORDER BY s.created_at DESC, b.id DESC""")
                .param(memberId)
                .query((rs, i) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("id"));
                    row.put("name", rs.getString("name"));
                    row.put("ownerNickname", rs.getString("owner_nickname"));
                    row.put("lastPostAt", rs.getObject("last_post_at", OffsetDateTime.class));
                    return row;
                }).list();
    }
}
