package com.myblog.post;

import com.myblog.blog.BlogService;
import com.myblog.blog.TopicService;
import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import com.myblog.image.ImageService;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 임시저장 글 (CF-05). 본인만 보고 고친다. 회원별 최대 개수가 있고, 글을 올리면 지운다.
 * 아직 올린 글이 아니라 제목이나 본문 중 하나만 있으면 되고, 분류는 비어 있어도 된다.
 */
@Service
public class DraftService {
    public record Request(String title, String body, Long categoryId, String topicCode, String visibility,
                          List<String> tags, List<Long> imageIds, Long coverImageId) {}

    private final JdbcClient jdbc;
    private final BlogService blogs;
    private final TagService tags;
    private final MyBlogProperties props;
    private final KoreanClock clock;
    private final TopicService topics;

    public DraftService(JdbcClient jdbc, BlogService blogs, TagService tags, MyBlogProperties props,
                        KoreanClock clock, TopicService topics) {
        this.jdbc = jdbc;
        this.blogs = blogs;
        this.tags = tags;
        this.props = props;
        this.clock = clock;
        this.topics = topics;
    }

    /** 최근에 저장한 것부터. 미리보기는 본문 앞부분. */
    public Map<String, Object> list(long memberId) {
        int excerpt = props.post().excerptLength();
        List<Map<String, Object>> items = jdbc.sql("""
                SELECT id, title, body, updated_at FROM drafts WHERE member_id = ? ORDER BY updated_at DESC, id DESC""")
                .param(memberId).query((rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    m.put("title", rs.getString("title"));
                    m.put("preview", ExcerptMaker.excerpt(rs.getString("body"), excerpt));
                    m.put("updatedAt", rs.getObject("updated_at", OffsetDateTime.class));
                    return m;
                }).list();
        return Map.of("items", items, "limit", props.draft().maxPerMember());
    }

    /** 이어 쓰기. 사진은 아직 남아 있는 내 사진만 돌려준다. */
    public Map<String, Object> get(long memberId, long draftId) {
        return jdbc.sql("""
                        SELECT d.*, t.code AS topic_code FROM drafts d LEFT JOIN topics t ON t.id = d.topic_id
                        WHERE d.id = ? AND d.member_id = ?""").params(draftId, memberId)
                .query((rs, i) -> view(rs, memberId)).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.DRAFT_NOT_FOUND));
    }

    private Map<String, Object> view(ResultSet rs, long memberId) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getLong("id"));
        m.put("title", rs.getString("title"));
        m.put("body", rs.getString("body"));
        long categoryId = rs.getLong("category_id");
        m.put("categoryId", rs.wasNull() ? null : categoryId);
        m.put("topicCode", rs.getString("topic_code"));
        m.put("visibility", rs.getString("visibility"));
        m.put("tags", Arrays.asList((String[]) array(rs.getArray("tags"))));
        Long[] imageIds = (Long[]) array(rs.getArray("image_ids"));
        m.put("images", jdbc.sql("""
                SELECT id, storage_key FROM post_images WHERE uploader_id = :me AND id IN (:ids) ORDER BY id""")
                .param("me", memberId).param("ids", imageIds.length == 0 ? List.of(-1L) : Arrays.asList(imageIds))
                .query((r, i) -> Map.of("id", r.getLong("id"), "url", ImageService.url(r.getString("storage_key"))))
                .list());
        long cover = rs.getLong("cover_image_id");
        m.put("coverImageId", rs.wasNull() ? null : cover);
        m.put("updatedAt", rs.getObject("updated_at", OffsetDateTime.class));
        return m;
    }

    private static Object array(Array a) throws SQLException {
        return a == null ? new Object[0] : a.getArray();
    }

    /** 새로 저장하거나(draftId = null) 덮어쓴다. 저장한 시각을 돌려준다. */
    @Transactional
    public Map<String, Object> save(long memberId, Long draftId, Request req) {
        String title = Texts.trim(req.title());
        String body = req.body() == null ? "" : req.body();
        if (title.isEmpty() && body.isBlank()) {
            throw ApiException.field("body", Messages.DRAFT_EMPTY);
        }
        if (Texts.length(title) > props.post().titleMax()) {
            throw ApiException.field("title", Messages.TITLE_TOO_LONG);
        }
        if (Texts.length(body) > props.post().bodyMax()) {
            throw ApiException.field("body", Messages.BODY_TOO_LONG);
        }
        Long categoryId = ownCategory(memberId, req.categoryId());
        Long topicId = topics.idOf(req.topicCode()).orElse(null);
        String visibility = "PRIVATE".equals(req.visibility()) ? "PRIVATE" : "PUBLIC";
        String[] tagArray = tags.normalize(req.tags()).toArray(String[]::new);
        Long[] imageIds = req.imageIds() == null ? new Long[0] : req.imageIds().stream().distinct().toArray(Long[]::new);
        OffsetDateTime now = clock.nowOffset();

        if (draftId == null) {
            long count = jdbc.sql("SELECT count(*) FROM drafts WHERE member_id = ?").param(memberId)
                    .query(Long.class).single();
            if (count >= props.draft().maxPerMember()) {
                throw new ApiException(ErrorCode.DRAFT_LIMIT, Messages.draftLimit(props.draft().maxPerMember()),
                        Map.of(), Map.of());
            }
            var keys = new GeneratedKeyHolder();
            jdbc.sql("""
                    INSERT INTO drafts (member_id, category_id, topic_id, title, body, visibility, tags, image_ids,
                                        cover_image_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                    .params(memberId, categoryId, topicId, title, body, visibility, tagArray, imageIds, req.coverImageId(), now, now)
                    .update(keys, "id");
            draftId = keys.getKey().longValue();
        } else {
            int n = jdbc.sql("""
                    UPDATE drafts SET category_id = ?, topic_id = ?, title = ?, body = ?, visibility = ?, tags = ?, image_ids = ?,
                                      cover_image_id = ?, updated_at = ?
                    WHERE id = ? AND member_id = ?""")
                    .params(categoryId, topicId, title, body, visibility, tagArray, imageIds, req.coverImageId(), now,
                            draftId, memberId)
                    .update();
            if (n == 0) {
                throw new ApiException(ErrorCode.DRAFT_NOT_FOUND);
            }
        }
        return Map.of("id", draftId, "updatedAt", now);
    }

    /** 내 블로그의 분류만. 지워졌거나 남의 분류면 비운다. */
    private Long ownCategory(long memberId, Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        Long blogId = blogs.blogIdOf(memberId).orElse(null);
        boolean mine = blogId != null && jdbc.sql("SELECT count(*) FROM categories WHERE id = ? AND blog_id = ?")
                .params(categoryId, blogId).query(Long.class).single() > 0;
        return mine ? categoryId : null;
    }

    public void delete(long memberId, long draftId) {
        int n = jdbc.sql("DELETE FROM drafts WHERE id = ? AND member_id = ?").params(draftId, memberId).update();
        if (n == 0) {
            throw new ApiException(ErrorCode.DRAFT_NOT_FOUND);
        }
    }

    /** 글을 올리면 그 임시저장 글은 지운다. 이미 없으면 그냥 넘어간다. */
    public void deleteQuietly(long memberId, Long draftId) {
        if (draftId != null) {
            jdbc.sql("DELETE FROM drafts WHERE id = ? AND member_id = ?").params(draftId, memberId).update();
        }
    }
}
