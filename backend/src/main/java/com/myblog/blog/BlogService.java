package com.myblog.blog;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 블로그 (CF-03, CF-04, BM-07, 요구사항.md 3.6). */
@Service
public class BlogService {
    public record BlogRow(long id, long ownerId, String name, String description, String about,
                          String topicCode, String topicName, String ownerNickname, String ownerBio) {}

    public record Update(String name, String description, String about, String topicCode) {}

    private final JdbcClient jdbc;
    private final MyBlogProperties props;
    private final TopicService topics;
    private final CategoryService categories;
    private final KoreanClock clock;

    public BlogService(JdbcClient jdbc, MyBlogProperties props, TopicService topics, CategoryService categories,
                       KoreanClock clock) {
        this.jdbc = jdbc;
        this.props = props;
        this.topics = topics;
        this.categories = categories;
        this.clock = clock;
    }

    /** 가입이 끝나면 "{닉네임}의 블로그"와 "미분류"를 만든다 (CF-03-2, CF-03-3). */
    @Transactional
    public long createFor(long memberId, String nickname) {
        OffsetDateTime now = clock.nowOffset();
        long topicId = topics.byCode(props.blog().defaultTopic()).id();
        var keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO blogs (owner_id, topic_id, name, comments_seen_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)""")
                .params(memberId, topicId, nickname + "의 블로그", now, now, now)
                .update(keys, "id");
        long blogId = keys.getKey().longValue();
        categories.createDefault(blogId);
        return blogId;
    }

    public Optional<BlogRow> find(long blogId) {
        return jdbc.sql("""
                SELECT b.id, b.owner_id, b.name, b.description, b.about, t.code AS topic_code, t.name AS topic_name,
                       m.nickname AS owner_nickname, m.bio AS owner_bio
                FROM blogs b JOIN topics t ON t.id = b.topic_id JOIN members m ON m.id = b.owner_id
                WHERE b.id = ? AND m.deleted_at IS NULL""").param(blogId).query(BlogRow.class).optional();
    }

    public BlogRow get(long blogId) {
        return find(blogId).orElseThrow(() -> new ApiException(ErrorCode.BLOG_NOT_FOUND));
    }

    public Optional<Long> blogIdOf(long memberId) {
        return jdbc.sql("SELECT id FROM blogs WHERE owner_id = ?").param(memberId).query(Long.class).optional();
    }

    public long requireOwnBlogId(long memberId) {
        return blogIdOf(memberId).orElseThrow(() -> new ApiException(ErrorCode.BLOG_NOT_FOUND));
    }

    /** 주인이 아니면 없는 블로그와 같게 거절한다 (NF-02). */
    public BlogRow requireOwner(long blogId, Long memberId) {
        BlogRow blog = get(blogId);
        if (memberId == null || blog.ownerId() != memberId) {
            throw new ApiException(ErrorCode.BLOG_NOT_FOUND);
        }
        return blog;
    }

    public Map<String, Object> summary(BlogRow b, Long viewerId) {
        boolean owner = viewerId != null && viewerId == b.ownerId();
        var stats = jdbc.sql("SELECT count(*) AS cnt, max(p.created_at) AS last_at FROM posts p"
                        + " WHERE p.blog_id = ? AND (? OR " + com.myblog.post.PostQueryService.PUBLIC_ONLY + ")")
                .params(b.id(), owner)
                .query((rs, i) -> new Object[] {rs.getLong("cnt"), rs.getObject("last_at", OffsetDateTime.class)})
                .single();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.id());
        m.put("name", b.name());
        m.put("description", b.description());
        m.put("topic", Map.of("code", b.topicCode(), "name", b.topicName()));
        m.put("owner", Map.of("nickname", b.ownerNickname(), "bio", b.ownerBio()));
        m.put("postCount", stats[0]);
        m.put("lastPostAt", stats[1]);
        m.put("isOwner", owner);
        return m;
    }

    @Transactional
    public void update(long blogId, long memberId, Update req) {
        BlogRow blog = requireOwner(blogId, memberId);
        String name = req.name() == null ? blog.name() : Texts.trim(req.name());
        if (name.isEmpty()) {
            throw ApiException.field("name", Messages.BLOG_NAME_REQUIRED);
        }
        if (Texts.length(name) > props.blog().nameMax()) {
            throw ApiException.field("name", Messages.BLOG_NAME_TOO_LONG);
        }
        String description = req.description() == null ? blog.description() : Texts.trim(req.description());
        if (Texts.length(description) > props.blog().descriptionMax()) {
            throw ApiException.field("description", Messages.BLOG_DESCRIPTION_TOO_LONG);
        }
        String about = req.about() == null ? blog.about() : req.about().strip();
        if (Texts.length(about) > props.blog().aboutMax()) {
            throw ApiException.field("about", "소개 글은 " + props.blog().aboutMax() + "자 이하로 입력해 주세요");
        }
        long topicId = topics.byCode(req.topicCode() == null ? blog.topicCode() : req.topicCode()).id();
        jdbc.sql("UPDATE blogs SET name = ?, description = ?, about = ?, topic_id = ?, updated_at = ? WHERE id = ?")
                .params(name, description, about, topicId, clock.nowOffset(), blogId).update();
    }
}
