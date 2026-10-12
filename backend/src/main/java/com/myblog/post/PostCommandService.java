package com.myblog.post;

import com.myblog.blog.BlogService;
import com.myblog.blog.CategoryService;
import com.myblog.blog.TopicService;
import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import com.myblog.image.ImageService;
import com.myblog.shop.InkService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 글 작성·수정·삭제 (CF-05, CF-13, CF-20, CF-22). */
@Service
public class PostCommandService {
    /** draftId: 임시저장 글을 이어 써서 올리면, 올린 뒤 그 임시저장 글을 지운다 (새 글에만 쓴다). */
    /** topicCode(분야)를 비우면 블로그의 주제로 쓴다. */
    public record Request(String title, String body, Long categoryId, String topicCode, String visibility,
                          List<String> tags, List<Long> imageIds, Long coverImageId, Long draftId) {}

    private record Valid(String title, String body, long categoryId, long topicId, String visibility,
                         List<String> tags) {}

    private final JdbcClient jdbc;
    private final MyBlogProperties props;
    private final BlogService blogs;
    private final CategoryService categories;
    private final PostQueryService queries;
    private final TagService tags;
    private final ImageService images;
    private final KoreanClock clock;
    private final DraftService drafts;
    private final TopicService topics;
    private final InkService ink;

    public PostCommandService(JdbcClient jdbc, MyBlogProperties props, BlogService blogs, CategoryService categories,
                              PostQueryService queries, TagService tags, ImageService images, KoreanClock clock,
                              DraftService drafts, TopicService topics, InkService ink) {
        this.jdbc = jdbc;
        this.props = props;
        this.blogs = blogs;
        this.categories = categories;
        this.queries = queries;
        this.tags = tags;
        this.images = images;
        this.clock = clock;
        this.drafts = drafts;
        this.topics = topics;
        this.ink = ink;
    }

    private Valid validate(long blogId, Request req) {
        String title = Texts.trim(req.title());
        if (title.isEmpty()) {
            throw ApiException.field("title", Messages.TITLE_REQUIRED);
        }
        if (Texts.length(title) > props.post().titleMax()) {
            throw ApiException.field("title", Messages.TITLE_TOO_LONG);
        }
        String body = req.body() == null ? "" : req.body();
        if (body.isBlank()) {
            throw ApiException.field("body", Messages.BODY_REQUIRED);
        }
        if (Texts.length(body) > props.post().bodyMax()) {
            throw ApiException.field("body", Messages.BODY_TOO_LONG);
        }
        if (req.categoryId() == null) {
            throw ApiException.field("categoryId", Messages.CATEGORY_REQUIRED);
        }
        var category = categories.get(req.categoryId());
        if (category.blogId() != blogId) {
            throw ApiException.field("categoryId", Messages.CATEGORY_REQUIRED);
        }
        long topicId = req.topicCode() == null || req.topicCode().isBlank()
                ? jdbc.sql("SELECT topic_id FROM blogs WHERE id = ?").param(blogId).query(Long.class).single()
                : topics.idOf(req.topicCode())
                        .orElseThrow(() -> ApiException.field("topicCode", Messages.TOPIC_REQUIRED));
        String visibility = req.visibility() == null ? "PUBLIC" : req.visibility();
        if (!visibility.equals("PUBLIC") && !visibility.equals("PRIVATE")) {
            throw ApiException.field("visibility", "공개 여부가 올바르지 않습니다");
        }
        return new Valid(title, body, category.id(), topicId, visibility, tags.normalize(req.tags()));
    }

    private Long cover(Request req, long memberId) {
        if (req.coverImageId() == null) {
            return null;
        }
        if (!images.ownedBy(req.coverImageId(), memberId)) {
            throw ApiException.field("coverImageId", "대표 사진을 다시 골라 주세요");
        }
        return req.coverImageId();
    }

    private List<Long> imageIds(Request req) {
        var ids = new java.util.LinkedHashSet<Long>(req.imageIds() == null ? List.of() : req.imageIds());
        if (req.coverImageId() != null) {
            ids.add(req.coverImageId());
        }
        return List.copyOf(ids);
    }

    /** 자기 블로그에만 쓸 수 있다 (CF-05-1). */
    @Transactional
    public long create(long blogId, long memberId, Request req) {
        blogs.requireOwner(blogId, memberId);
        Valid v = validate(blogId, req);
        Long cover = cover(req, memberId);
        var keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO posts (blog_id, author_id, category_id, topic_id, title, body, visibility, cover_image_id,
                                   created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                .params(blogId, memberId, v.categoryId(), v.topicId(), v.title(), v.body(), v.visibility(), cover,
                        clock.nowOffset())
                .update(keys, "id");
        long id = keys.getKey().longValue();
        tags.replace(id, v.tags());
        images.attach(id, memberId, imageIds(req));
        drafts.deleteQuietly(memberId, req.draftId());
        ink.rewardPost(memberId, id, v.visibility()); // 스티커 상점: 공개 글이면 잉크 (하루 한도)
        return id;
    }

    /** 작성자만. 제목·본문·분류·분야·공개 여부가 실제로 바뀐 때만 수정 시각을 갱신한다 (CF-05-13). */
    @Transactional
    public void update(long postId, long memberId, Request req) {
        var p = queries.requireAuthor(postId, memberId);
        Valid v = validate(p.blogId(), req);
        Long cover = cover(req, memberId);
        boolean changed = !p.title().equals(v.title()) || !p.body().equals(v.body())
                || p.categoryId() != v.categoryId() || p.topicId() != v.topicId()
                || !p.visibility().equals(v.visibility());
        OffsetDateTime updatedAt = changed ? clock.nowOffset() : p.contentUpdatedAt();
        jdbc.sql("""
                UPDATE posts SET title = ?, body = ?, category_id = ?, topic_id = ?, visibility = ?, cover_image_id = ?,
                                content_updated_at = ?
                WHERE id = ?""")
                .params(v.title(), v.body(), v.categoryId(), v.topicId(), v.visibility(), cover, updatedAt, postId)
                .update();
        tags.replace(postId, v.tags());
        images.attach(postId, memberId, imageIds(req));
        // 본문에서 빠진 이미지는 연결만 풀린다. 24시간 정리 작업이 지운다.
    }

    /** 댓글·좋아요·태그 연결·이미지 기록은 FK로 함께 지우고, 파일은 커밋 후 지운다 (CF-05-15). */
    @Transactional
    public long delete(long postId, long memberId) {
        var p = queries.requireAuthor(postId, memberId);
        List<String> keys = images.keysOfPost(postId);
        jdbc.sql("DELETE FROM posts WHERE id = ?").param(postId).update();
        images.deleteFilesAfterCommit(keys);
        return p.blogId();
    }

    /**
     * 대표글 고정·해제 (작성자만). 블로그마다 최대 pin-limit개. 동시에 눌러도 넘지 않게 블로그 줄을 잠그고 센다.
     * 고정됐으면 true.
     */
    @Transactional
    public boolean togglePin(long postId, long memberId) {
        var p = queries.requireAuthor(postId, memberId);
        jdbc.sql("SELECT id FROM blogs WHERE id = ? FOR UPDATE").param(p.blogId()).query(Long.class).single();
        boolean pinned = jdbc.sql("SELECT pinned_at IS NOT NULL FROM posts WHERE id = ?").param(postId)
                .query(Boolean.class).single();
        if (pinned) {
            jdbc.sql("UPDATE posts SET pinned_at = NULL WHERE id = ?").param(postId).update();
            return false;
        }
        int limit = props.post().pinLimit();
        long count = jdbc.sql("SELECT count(*) FROM posts WHERE blog_id = ? AND pinned_at IS NOT NULL")
                .param(p.blogId()).query(Long.class).single();
        if (count >= limit) {
            throw new ApiException(ErrorCode.PIN_LIMIT, Messages.pinLimit(limit), Map.of(), Map.of());
        }
        jdbc.sql("UPDATE posts SET pinned_at = ? WHERE id = ?").params(clock.nowOffset(), postId).update();
        return true;
    }

    /** 다이어리 편집: 내 글들이 이 블로그 글인지 확인한다. 하나라도 아니면 없는 글과 같게 거절한다. */
    private List<Long> requireOwnPosts(long blogId, long memberId, List<Long> postIds) {
        blogs.requireOwner(blogId, memberId);
        List<Long> ids = postIds == null ? List.of() : postIds.stream().distinct().toList();
        if (ids.isEmpty()) {
            throw ApiException.field("postIds", Messages.POSTS_REQUIRED);
        }
        long mine = jdbc.sql("SELECT count(*) FROM posts WHERE blog_id = :blog AND author_id = :me AND id IN (:ids)")
                .param("blog", blogId).param("me", memberId).param("ids", ids).query(Long.class).single();
        if (mine != ids.size()) {
            throw new ApiException(ErrorCode.POST_NOT_FOUND);
        }
        return ids;
    }

    /** 다이어리 편집: 글 여러 개를 다른 다이어리로 한꺼번에 옮긴다. 수정 시각은 바꾸지 않는다. */
    @Transactional
    public int movePosts(long blogId, long memberId, List<Long> postIds, Long categoryId) {
        List<Long> ids = requireOwnPosts(blogId, memberId, postIds);
        if (categoryId == null || categories.get(categoryId).blogId() != blogId) {
            throw ApiException.field("categoryId", Messages.CATEGORY_REQUIRED);
        }
        return jdbc.sql("UPDATE posts SET category_id = :cat WHERE id IN (:ids)")
                .param("cat", categoryId).param("ids", ids).update();
    }

    /** 다이어리 편집: 글 여러 개를 한꺼번에 지운다. 댓글·좋아요·태그 연결은 FK로, 사진 파일은 커밋 뒤 지운다. */
    @Transactional
    public int deletePosts(long blogId, long memberId, List<Long> postIds) {
        List<Long> ids = requireOwnPosts(blogId, memberId, postIds);
        List<String> keys = jdbc.sql("SELECT storage_key FROM post_images WHERE post_id IN (:ids)").param("ids", ids)
                .query(String.class).list();
        int n = jdbc.sql("DELETE FROM posts WHERE id IN (:ids)").param("ids", ids).update();
        images.deleteFilesAfterCommit(keys);
        return n;
    }

    /** 글쓰기 기본 분류: 마지막으로 쓴 글의 분류, 처음이면 "미분류" (CF-05-5). */
    public Map<String, Long> lastCategory(long memberId) {
        long blogId = blogs.requireOwnBlogId(memberId);
        Long id = jdbc.sql("""
                SELECT category_id FROM posts WHERE blog_id = ? ORDER BY created_at DESC, id DESC LIMIT 1""")
                .param(blogId).query(Long.class).optional()
                .orElseGet(() -> jdbc.sql("SELECT id FROM categories WHERE blog_id = ? AND is_default")
                        .param(blogId).query(Long.class).single());
        return Map.of("categoryId", id);
    }
}
