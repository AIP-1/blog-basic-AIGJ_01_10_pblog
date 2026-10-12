package com.myblog.post;

import com.myblog.blog.BlogService;
import com.myblog.comment.CommentService;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.PageResponse;
import com.myblog.image.ImageService;
import com.myblog.stats.ViewRecorder;
import com.myblog.stats.VisitorIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** contracts/api.md '글'과 '소통·부가'의 좋아요·신고·태그. */
@RestController
public class PostController {
    public record ReportRequest(String reason, String detail) {}

    private final PostQueryService queries;
    private final PostCommandService commands;
    private final InteractionService interactions;
    private final TagService tags;
    private final CommentService comments;
    private final BlogService blogs;
    private final ViewRecorder views;
    private final JdbcClient jdbc;
    private final MyBlogProperties props;

    public PostController(PostQueryService queries, PostCommandService commands, InteractionService interactions,
                          TagService tags, CommentService comments, BlogService blogs, ViewRecorder views,
                          JdbcClient jdbc, MyBlogProperties props) {
        this.queries = queries;
        this.commands = commands;
        this.interactions = interactions;
        this.tags = tags;
        this.comments = comments;
        this.blogs = blogs;
        this.views = views;
        this.jdbc = jdbc;
        this.props = props;
    }

    /** sort: latest(기본) · popular · oldest, tag: 이 태그가 붙은 글만 */
    @GetMapping("/api/blogs/{blogId}/posts")
    public PageResponse<Map<String, Object>> blogPosts(@PathVariable long blogId,
                                                       @RequestParam(required = false) Long categoryId,
                                                       @RequestParam(required = false) String tag,
                                                       @RequestParam(required = false) String sort,
                                                       @RequestParam(required = false) Integer page,
                                                       @AuthenticationPrincipal Long viewer) {
        blogs.get(blogId);
        String tagKey = tag == null ? null : TagService.key(tag.strip().replaceFirst("^#+", ""));
        return queries.blogPosts(blogId, categoryId, tagKey, sort, viewer, page);
    }

    /** 블로그 왼쪽 태그 모음 */
    @GetMapping("/api/blogs/{blogId}/tags")
    public List<Map<String, Object>> blogTags(@PathVariable long blogId, @AuthenticationPrincipal Long viewer) {
        blogs.get(blogId);
        return queries.blogTags(blogId, viewer, props.blog().blogTags());
    }

    @GetMapping("/api/posts/{id}")
    public Map<String, Object> detail(@PathVariable long id, @AuthenticationPrincipal Long viewer,
                                      HttpServletRequest req) {
        var p = queries.requireVisible(id, viewer);
        views.record(p, viewer, (String) req.getAttribute(VisitorIdFilter.ATTRIBUTE));
        var blog = blogs.get(p.blogId());
        var n = queries.neighbors(p);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id());
        m.put("blog", Map.of("id", blog.id(), "name", blog.name(), "description", blog.description(),
                "owner", Map.of("nickname", blog.ownerNickname(), "bio", blog.ownerBio())));
        m.put("topic", Map.of("code", p.topicCode(), "name", p.topicName()));
        m.put("category", Map.of("id", p.categoryId(), "name", p.categoryName(),
                "colorIndex", p.categoryColorIndex()));
        m.put("title", p.title());
        m.put("body", p.body());
        m.put("createdAt", p.createdAt());
        m.put("contentUpdatedAt", p.contentUpdatedAt());
        m.put("visibility", p.visibility());
        m.put("coverImageUrl", p.coverKey() == null ? null : ImageService.url(p.coverKey()));
        m.put("tags", tags.tagsOf(p.id()));
        m.put("viewCount", p.viewCount());
        m.put("likeCount", interactions.likeCount(p.id()));
        m.put("likedByMe", interactions.likedBy(p.id(), viewer));
        m.put("commentCount", comments.count(p.id()));
        m.put("prev", n.get("prev").orElse(null));
        m.put("next", n.get("next").orElse(null));
        m.put("otherPosts", queries.otherPosts(p));
        m.put("isAuthor", viewer != null && viewer == p.authorId());
        m.put("pinned", jdbc.sql("SELECT pinned_at IS NOT NULL FROM posts WHERE id = ?").param(p.id())
                .query(Boolean.class).single());
        return m;
    }

    /** 대표글 고정·해제 (작성자만) */
    @PutMapping("/api/posts/{id}/pin")
    public Map<String, Object> pin(@PathVariable long id, @AuthenticationPrincipal Long me) {
        return Map.of("pinned", commands.togglePin(id, me));
    }

    /** 블로그 첫 화면 위쪽 대표글 */
    @GetMapping("/api/blogs/{blogId}/pinned")
    public List<Map<String, Object>> pinned(@PathVariable long blogId, @AuthenticationPrincipal Long viewer) {
        blogs.get(blogId);
        return queries.pinned(blogId, viewer);
    }

    public record BulkRequest(List<Long> postIds, Long categoryId) {}

    /** 다이어리 편집: 고른 글을 다른 다이어리로 옮긴다 */
    @PostMapping("/api/blogs/{blogId}/posts/move")
    public Map<String, Object> movePosts(@PathVariable long blogId, @AuthenticationPrincipal Long me,
                                         @RequestBody BulkRequest req) {
        return Map.of("moved", commands.movePosts(blogId, me, req.postIds(), req.categoryId()));
    }

    /** 다이어리 편집: 고른 글을 한꺼번에 지운다 */
    @PostMapping("/api/blogs/{blogId}/posts/delete")
    public Map<String, Object> deletePosts(@PathVariable long blogId, @AuthenticationPrincipal Long me,
                                           @RequestBody BulkRequest req) {
        return Map.of("deleted", commands.deletePosts(blogId, me, req.postIds()));
    }

    @GetMapping("/api/posts/{id}/edit")
    public Map<String, Object> editSource(@PathVariable long id, @AuthenticationPrincipal Long me) {
        var p = queries.requireAuthor(id, me);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id());
        m.put("blogId", p.blogId());
        m.put("title", p.title());
        m.put("body", p.body());
        m.put("categoryId", p.categoryId());
        m.put("visibility", p.visibility());
        m.put("tags", tags.tagsOf(p.id()));
        m.put("images", jdbc.sql("SELECT id, storage_key FROM post_images WHERE post_id = ? ORDER BY id")
                .param(p.id()).query((rs, i) -> Map.of("id", rs.getLong("id"),
                        "url", ImageService.url(rs.getString("storage_key")))).list());
        m.put("coverImageId", jdbc.sql("SELECT cover_image_id FROM posts WHERE id = ?").param(p.id())
                .query(Long.class).optional().orElse(null));
        return m;
    }

    @PostMapping("/api/blogs/{blogId}/posts")
    public ResponseEntity<Map<String, Long>> create(@PathVariable long blogId, @AuthenticationPrincipal Long me,
                                                    @RequestBody PostCommandService.Request req) {
        return ResponseEntity.status(201).body(Map.of("id", commands.create(blogId, me, req)));
    }

    @PutMapping("/api/posts/{id}")
    public Map<String, Long> update(@PathVariable long id, @AuthenticationPrincipal Long me,
                                    @RequestBody PostCommandService.Request req) {
        commands.update(id, me, req);
        return Map.of("id", id);
    }

    @DeleteMapping("/api/posts/{id}")
    public Map<String, Long> delete(@PathVariable long id, @AuthenticationPrincipal Long me) {
        return Map.of("blogId", commands.delete(id, me));
    }

    @GetMapping("/api/me/last-category")
    public Map<String, Long> lastCategory(@AuthenticationPrincipal Long me) {
        return commands.lastCategory(me);
    }

    @PutMapping("/api/posts/{id}/like")
    public Map<String, Object> like(@PathVariable long id, @AuthenticationPrincipal Long me) {
        return interactions.toggleLike(id, me);
    }

    @PostMapping("/api/posts/{id}/reports")
    public ResponseEntity<Void> report(@PathVariable long id, @AuthenticationPrincipal Long me,
                                       @RequestBody ReportRequest req) {
        interactions.report(id, me, req.reason(), req.detail());
        return ResponseEntity.status(201).build();
    }

    @GetMapping("/api/tags/{name}/posts")
    public Map<String, Object> tagPosts(@PathVariable String name, @RequestParam(required = false) Integer page) {
        String clean = name.strip().replaceFirst("^#+", "");
        var result = queries.tagPosts(TagService.key(clean), page);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tag", clean);
        m.put("items", result.items());
        m.put("page", result.page());
        m.put("size", result.size());
        m.put("totalItems", result.totalItems());
        m.put("totalPages", result.totalPages());
        return m;
    }

}
