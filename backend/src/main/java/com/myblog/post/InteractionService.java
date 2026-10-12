package com.myblog.post;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 좋아요 (CF-19)와 신고 (CF-21). */
@Service
public class InteractionService {
    private static final Set<String> REASONS = Set.of("SPAM", "ABUSE", "ADULT", "OTHER");

    private final JdbcClient jdbc;
    private final PostQueryService queries;
    private final MyBlogProperties props;
    private final KoreanClock clock;

    public InteractionService(JdbcClient jdbc, PostQueryService queries, MyBlogProperties props, KoreanClock clock) {
        this.jdbc = jdbc;
        this.queries = queries;
        this.props = props;
        this.clock = clock;
    }

    public long likeCount(long postId) {
        return jdbc.sql("SELECT count(*) FROM post_likes WHERE post_id = ?").param(postId).query(Long.class).single();
    }

    public boolean likedBy(long postId, Long memberId) {
        return memberId != null && jdbc.sql("SELECT count(*) FROM post_likes WHERE post_id = ? AND member_id = ?")
                .params(postId, memberId).query(Long.class).single() > 0;
    }

    /** 누르면 좋아요, 다시 누르면 취소. 자기 글은 불가. */
    @Transactional
    public Map<String, Object> toggleLike(long postId, long memberId) {
        var p = queries.requireVisible(postId, memberId);
        if (p.authorId() == memberId) {
            throw new ApiException(ErrorCode.OWN_POST);
        }
        int removed = jdbc.sql("DELETE FROM post_likes WHERE post_id = ? AND member_id = ?")
                .params(postId, memberId).update();
        if (removed == 0) {
            jdbc.sql("INSERT INTO post_likes (post_id, member_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
                    .params(postId, memberId, clock.nowOffset()).update();
        }
        return Map.of("liked", removed == 0, "likeCount", likeCount(postId));
    }

    @Transactional
    public void report(long postId, long memberId, String reason, String rawDetail) {
        var p = queries.requireVisible(postId, memberId);
        if (p.authorId() == memberId) {
            throw new ApiException(ErrorCode.OWN_POST);
        }
        if (reason == null || !REASONS.contains(reason)) {
            throw ApiException.field("reason", Messages.REPORT_REASON_REQUIRED);
        }
        String detail = "OTHER".equals(reason) ? Texts.trim(rawDetail) : "";
        if (Texts.length(detail) > props.report().detailMax()) {
            throw ApiException.field("detail", Messages.REPORT_DETAIL_TOO_LONG);
        }
        try {
            jdbc.sql("INSERT INTO post_flags (post_id, reporter_id, reason, detail, created_at) VALUES (?, ?, ?, ?, ?)")
                    .params(postId, memberId, reason, detail, clock.nowOffset()).update();
        } catch (DuplicateKeyException e) {
            throw new ApiException(ErrorCode.ALREADY_REPORTED);
        }
    }
}
