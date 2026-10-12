package com.myblog.comment;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.RedisGuard;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import com.myblog.post.PostQueryService;
import com.myblog.shop.InkService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;

/** 블로그 글 댓글 (CF-18). 답글은 한 단계만 단다. */
@Service
public class CommentService {
    public record CommentRow(long id, long postId, Long parentId, Long authorId, String authorNickname, String body,
                             OffsetDateTime createdAt, long blogOwnerId) {}

    private final JdbcClient jdbc;
    private final PostQueryService posts;
    private final StringRedisTemplate redis;
    private final RedisGuard guard;
    private final MyBlogProperties.Comment rules;
    private final KoreanClock clock;
    private final InkService ink;

    public CommentService(JdbcClient jdbc, PostQueryService posts, StringRedisTemplate redis, RedisGuard guard,
                          MyBlogProperties props, KoreanClock clock, InkService ink) {
        this.jdbc = jdbc;
        this.posts = posts;
        this.redis = redis;
        this.guard = guard;
        this.rules = props.comment();
        this.clock = clock;
        this.ink = ink;
    }

    private static final String SELECT = """
            SELECT cm.id, cm.post_id, cm.parent_id,
                   CASE WHEN m.deleted_at IS NULL THEN cm.author_id END AS author_id, -- 탈퇴 신청·익명화한 회원은 "탈퇴한 사용자"
                   m.nickname AS author_nickname, cm.body, cm.created_at,
                   b.owner_id AS blog_owner_id
            FROM comments cm JOIN posts p ON p.id = cm.post_id JOIN blogs b ON b.id = p.blog_id
            LEFT JOIN members m ON m.id = cm.author_id
            """;

    static Map<String, Object> view(CommentRow c, Long viewer) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", c.id());
        v.put("parentId", c.parentId());
        v.put("author", c.authorId() == null ? null : Map.of("id", c.authorId(), "nickname", c.authorNickname()));
        v.put("body", c.body());
        v.put("createdAt", c.createdAt());
        v.put("canDelete", viewer != null && (viewer.equals(c.authorId()) || viewer == c.blogOwnerId()));
        return v;
    }

    /**
     * 오래된 원 댓글이 위, 답글은 원 댓글 아래 replies에 오래된 순 (CF-18-3).
     * 쿼리 한 번으로 "원 댓글, 그 답글들, 다음 원 댓글…" 순서로 읽어 묶는다. 작성자가 탈퇴했으면 author = null.
     */
    public List<Map<String, Object>> list(long postId, Long viewer) {
        posts.requireVisible(postId, viewer);
        List<CommentRow> rows = jdbc.sql(SELECT + """
                 WHERE cm.post_id = ?
                ORDER BY COALESCE(cm.parent_id, cm.id), cm.parent_id NULLS FIRST, cm.created_at, cm.id""")
                .param(postId).query(CommentRow.class).list();
        List<Map<String, Object>> roots = new ArrayList<>();
        List<Map<String, Object>> replies = null;
        for (CommentRow c : rows) {
            Map<String, Object> v = view(c, viewer);
            if (c.parentId() == null) {
                replies = new ArrayList<>();
                v.put("replies", replies);
                roots.add(v);
            } else if (replies != null) {
                replies.add(v);
            }
        }
        return roots;
    }

    public long count(long postId) {
        return jdbc.sql("SELECT count(*) FROM comments WHERE post_id = ?").param(postId).query(Long.class).single();
    }

    public Map<String, Object> create(long postId, long memberId, String rawBody, Long parentId) {
        var post = posts.requireVisible(postId, memberId);
        if (parentId != null) {
            // 같은 글의 원 댓글에만 답글을 단다 (답글의 답글은 안 됨)
            boolean ok = jdbc.sql("SELECT count(*) FROM comments WHERE id = ? AND post_id = ? AND parent_id IS NULL")
                    .params(parentId, postId).query(Long.class).single() > 0;
            if (!ok) {
                throw ApiException.field("parentId", Messages.REPLY_PARENT_NOT_FOUND);
            }
        }
        String body = rawBody == null ? "" : rawBody.strip();
        if (body.isEmpty()) {
            throw ApiException.field("body", Messages.COMMENT_REQUIRED);
        }
        if (Texts.length(body) > rules.bodyMax()) {
            throw ApiException.field("body", Messages.COMMENT_TOO_LONG);
        }
        boolean allowed = guard.optional(() -> redis.opsForValue()
                .setIfAbsent("comment:cooldown:" + memberId, "1", rules.cooldown())).orElse(true);
        if (!allowed) {
            throw new ApiException(ErrorCode.COMMENT_TOO_SOON); // 5초 안에 다시 등록 (CF-18-7)
        }
        var keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO comments (post_id, parent_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
                .params(postId, parentId, memberId, body, clock.nowOffset()).update(keys, "id");
        long id = keys.getKey().longValue();
        ink.rewardComment(memberId, post.authorId(), id); // 스티커 상점: 다른 사람 글이면 잉크 (하루 한도)
        return view(jdbc.sql(SELECT + " WHERE cm.id = ?").param(id).query(CommentRow.class).single(), memberId);
    }

    /** 댓글 작성자와 그 글의 블로그 주인만 지운다 (CF-18-4). 원 댓글을 지우면 답글도 함께 지워진다(ON DELETE CASCADE). */
    public void delete(long commentId, long memberId) {
        CommentRow c = jdbc.sql(SELECT + " WHERE cm.id = ?").param(commentId).query(CommentRow.class).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.COMMENT_NOT_FOUND));
        if (!Long.valueOf(memberId).equals(c.authorId()) && c.blogOwnerId() != memberId) {
            throw new ApiException(ErrorCode.COMMENT_NOT_FOUND);
        }
        jdbc.sql("DELETE FROM comments WHERE id = ?").param(commentId).update();
    }
}
