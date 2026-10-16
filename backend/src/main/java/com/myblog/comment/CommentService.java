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
import org.springframework.transaction.annotation.Transactional;

/**
 * 블로그 글 댓글 (CF-18). 답글은 한 단계만 단다.
 * 비밀 댓글(v1.11.0): 쓴 사람, 그 글의 블로그 주인, (답글이면) 원 댓글을 쓴 사람만 내용을 본다.
 * 그 밖의 사람에게는 내용과 작성자를 빼고 "비밀 댓글"이라는 표시만 준다. 비밀 댓글에 단 답글은 늘 비밀이다.
 */
@Service
public class CommentService {
    public record CommentRow(long id, long postId, Long parentId, Long authorId, String authorNickname, String body,
                             OffsetDateTime createdAt, long blogOwnerId, boolean secret, Long parentAuthorId) {}

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
                   b.owner_id AS blog_owner_id, cm.secret, pc.author_id AS parent_author_id
            FROM comments cm JOIN posts p ON p.id = cm.post_id JOIN blogs b ON b.id = p.blog_id
            LEFT JOIN members m ON m.id = cm.author_id
            LEFT JOIN comments pc ON pc.id = cm.parent_id
            """;

    /** 비밀 댓글의 내용을 볼 수 있는 사람인가. 공개 댓글은 누구나 본다. */
    static boolean canRead(CommentRow c, Long viewer) {
        if (!c.secret()) {
            return true;
        }
        return viewer != null
                && (viewer.equals(c.authorId()) || viewer == c.blogOwnerId() || viewer.equals(c.parentAuthorId()));
    }

    static Map<String, Object> view(CommentRow c, Long viewer) {
        Map<String, Object> v = new LinkedHashMap<>();
        boolean readable = canRead(c, viewer);
        v.put("id", c.id());
        v.put("parentId", c.parentId());
        v.put("secret", c.secret());
        v.put("hidden", !readable); // true면 내용 · 작성자를 보내지 않는다 (화면은 "비밀 댓글입니다")
        v.put("author", !readable || c.authorId() == null ? null
                : Map.of("id", c.authorId(), "nickname", c.authorNickname()));
        v.put("body", readable ? c.body() : null);
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

    /** 댓글과 잉크를 한 트랜잭션에 저장한다. 잉크 저장이 실패하면 댓글도 남지 않는다. */
    @Transactional
    public Map<String, Object> create(long postId, long memberId, String rawBody, Long parentId, boolean secret) {
        var post = posts.requireVisible(postId, memberId);
        if (parentId != null) {
            // 같은 글의 원 댓글에만 답글을 단다 (답글의 답글은 안 됨)
            CommentRow parent = jdbc.sql(SELECT + " WHERE cm.id = ? AND cm.post_id = ? AND cm.parent_id IS NULL")
                    .params(parentId, postId).query(CommentRow.class).optional().orElse(null);
            // 내용을 볼 수 없는 비밀 댓글에는 답글을 달 수 없다. 있는지 없는지도 알리지 않으려고 같은 오류를 낸다
            if (parent == null || !canRead(parent, memberId)) {
                throw ApiException.field("parentId", Messages.REPLY_PARENT_NOT_FOUND);
            }
            secret = secret || parent.secret(); // 비밀 댓글에 단 답글은 비밀
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
        jdbc.sql("INSERT INTO comments (post_id, parent_id, author_id, body, created_at, secret) VALUES (?, ?, ?, ?, ?, ?)")
                .params(postId, parentId, memberId, body, clock.nowOffset(), secret).update(keys, "id");
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
