package com.myblog.comment;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CommentController {
    /** secret이 true면 비밀 댓글. 비우면 공개 댓글 */
    public record CommentRequest(String body, Long parentId, Boolean secret) {}

    private final CommentService comments;

    public CommentController(CommentService comments) {
        this.comments = comments;
    }

    @GetMapping("/api/posts/{postId}/comments")
    public List<Map<String, Object>> list(@PathVariable long postId, @AuthenticationPrincipal Long viewer) {
        return comments.list(postId, viewer);
    }

    @PostMapping("/api/posts/{postId}/comments")
    public ResponseEntity<Map<String, Object>> create(@PathVariable long postId, @AuthenticationPrincipal Long me,
                                                      @RequestBody CommentRequest req) {
        return ResponseEntity.status(201).body(comments.create(postId, me, req.body(), req.parentId(), Boolean.TRUE.equals(req.secret())));
    }

    @DeleteMapping("/api/comments/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id, @AuthenticationPrincipal Long me) {
        comments.delete(id, me);
        return ResponseEntity.noContent().build();
    }
}
