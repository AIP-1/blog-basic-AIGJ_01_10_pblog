package com.myblog.blog;

import com.myblog.common.error.ApiException;
import com.myblog.common.PageResponse;
import com.myblog.common.error.ErrorCode;
import com.myblog.post.PostQueryService;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BlogController {
    public record NameRequest(String name) {}

    public record MoveRequest(String direction) {}

    private final BlogService blogs;
    private final CategoryService categories;
    private final SubscriptionService subscriptions;
    private final PostQueryService posts;

    public BlogController(BlogService blogs, CategoryService categories, SubscriptionService subscriptions,
                          PostQueryService posts) {
        this.blogs = blogs;
        this.categories = categories;
        this.subscriptions = subscriptions;
        this.posts = posts;
    }

    @GetMapping("/api/blogs/{blogId}")
    public Map<String, Object> blog(@PathVariable long blogId, @AuthenticationPrincipal Long viewer) {
        var m = blogs.summary(blogs.get(blogId), viewer);
        m.put("subscriberCount", subscriptions.subscriberCount(blogId));
        m.put("subscribedByMe", subscriptions.subscribedBy(blogId, viewer));
        return m;
    }

    /** 구독: 누르면 구독, 다시 누르면 취소. 내 블로그는 안 된다. */
    @PutMapping("/api/blogs/{blogId}/subscribe")
    public Map<String, Object> subscribe(@PathVariable long blogId, @AuthenticationPrincipal Long me) {
        return subscriptions.toggle(blogId, me);
    }

    /** 내가 구독한 블로그: 최근에 구독한 것부터 */
    @GetMapping("/api/me/subscriptions")
    public List<Map<String, Object>> mySubscriptions(@AuthenticationPrincipal Long me) {
        return subscriptions.mine(me);
    }

    /** 내가 구독한 다이어리: 최근에 구독한 것부터 */
    @GetMapping("/api/me/subscriptions/diaries")
    public List<Map<String, Object>> myDiarySubscriptions(@AuthenticationPrincipal Long me) {
        return subscriptions.mineDiaries(me);
    }

    /**
     * 구독 피드: 공개 글과 구독자만 글, 최신순. kind = all(둘 다, 겹치는 글은 한 번) · diary(구독한 다이어리) ·
     * blog(구독한 블로그)
     */
    @GetMapping("/api/me/subscriptions/posts")
    public PageResponse<Map<String, Object>> subscriptionPosts(@AuthenticationPrincipal Long me,
                                                               @RequestParam(required = false) String kind,
                                                               @RequestParam(required = false) Integer page) {
        return posts.subscriptionFeed(me, kind, page);
    }

    @GetMapping("/api/blogs/{blogId}/about")
    public Map<String, Object> about(@PathVariable long blogId) {
        var b = blogs.get(blogId);
        return Map.of("ownerNickname", b.ownerNickname(), "ownerBio", b.ownerBio(), "about", b.about());
    }

    @PatchMapping("/api/blogs/{blogId}")
    public ResponseEntity<Void> update(@PathVariable long blogId, @AuthenticationPrincipal Long me,
                                       @RequestBody BlogService.Update req) {
        blogs.update(blogId, me, req);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/blogs/{blogId}/categories")
    public List<CategoryService.CategoryView> categories(@PathVariable long blogId,
                                                         @AuthenticationPrincipal Long viewer) {
        var b = blogs.get(blogId);
        return categories.list(blogId, viewer != null && viewer == b.ownerId(), viewer);
    }

    @PostMapping("/api/blogs/{blogId}/categories")
    public ResponseEntity<Map<String, Long>> add(@PathVariable long blogId, @AuthenticationPrincipal Long me,
                                                 @RequestBody NameRequest req) {
        blogs.requireOwner(blogId, me);
        return ResponseEntity.status(201).body(Map.of("id", categories.add(blogId, req.name())));
    }

    /** 다이어리 설정 (이름·소개·표지 색·공개 범위). 보낸 칸만 바꾼다. */
    @PatchMapping("/api/categories/{id}")
    public ResponseEntity<Void> update(@PathVariable long id, @AuthenticationPrincipal Long me,
                                       @RequestBody CategoryService.Update req) {
        categories.update(id, ownBlog(me), req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/categories/{id}/move")
    public ResponseEntity<Void> move(@PathVariable long id, @AuthenticationPrincipal Long me,
                                     @RequestBody MoveRequest req) {
        categories.move(id, ownBlog(me), req.direction());
        return ResponseEntity.ok().build();
    }

    /** 다이어리 구독: 누르면 구독, 다시 누르면 취소. 내 다이어리·비공개 다이어리는 안 되고, 구독자만 다이어리는 블로그 구독자만. */
    @PutMapping("/api/categories/{id}/subscribe")
    public Map<String, Object> subscribeDiary(@PathVariable long id, @AuthenticationPrincipal Long me) {
        return subscriptions.toggleDiary(id, me);
    }

    @DeleteMapping("/api/categories/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id, @AuthenticationPrincipal Long me) {
        categories.delete(id, ownBlog(me));
        return ResponseEntity.noContent().build();
    }

    private long ownBlog(Long me) {
        if (me == null) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED);
        }
        return blogs.requireOwnBlogId(me);
    }
}
