package com.myblog.post;

import com.myblog.common.PageResponse;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
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

/** 책갈피 (데모 '저장'): 글을 폴더에 꽂기 · 옮기기 · 빼기, 폴더 만들기 · 이름 바꾸기 · 지우기, 내 책갈피 목록. */
@RestController
public class BookmarkController {
    public record SaveRequest(Long folderId) {}

    public record NameRequest(String name) {}

    private final BookmarkService bookmarks;
    private final PostQueryService queries;

    public BookmarkController(BookmarkService bookmarks, PostQueryService queries) {
        this.bookmarks = bookmarks;
        this.queries = queries;
    }

    /** 꽂거나, 이미 꽂은 글이면 폴더만 옮긴다. folderId가 없으면 미분류. 응답은 꽂힌 폴더. */
    @PutMapping("/api/posts/{id}/bookmark")
    public Map<String, Object> save(@PathVariable long id, @AuthenticationPrincipal Long me,
                                    @RequestBody(required = false) SaveRequest req) {
        return bookmarks.save(id, me, req == null ? null : req.folderId());
    }

    @DeleteMapping("/api/posts/{id}/bookmark")
    public ResponseEntity<Void> remove(@PathVariable long id, @AuthenticationPrincipal Long me) {
        bookmarks.remove(id, me);
        return ResponseEntity.noContent().build();
    }

    /**
     * 내 책갈피: 최근에 꽂은 것부터. 지금 볼 수 없는 글은 빠진다.
     * folder: all(기본) · none(미분류) · 폴더 id
     */
    @GetMapping("/api/me/bookmarks")
    public PageResponse<Map<String, Object>> list(@AuthenticationPrincipal Long me,
                                                  @RequestParam(required = false) String folder,
                                                  @RequestParam(required = false) Integer page) {
        if (folder == null || folder.isBlank() || "all".equals(folder)) {
            return queries.bookmarks(me, null, false, page);
        }
        if ("none".equals(folder)) {
            return queries.bookmarks(me, null, true, page);
        }
        long folderId;
        try {
            folderId = Long.parseLong(folder);
        } catch (NumberFormatException e) {
            throw new ApiException(ErrorCode.BOOKMARK_FOLDER_NOT_FOUND);
        }
        bookmarks.requireFolder(folderId, me);
        return queries.bookmarks(me, folderId, false, page);
    }

    /** 폴더 탭: { total, none, folders: [{ id, name, createdAt, count }] } */
    @GetMapping("/api/me/bookmark-folders")
    public Map<String, Object> folders(@AuthenticationPrincipal Long me) {
        return bookmarks.folders(me);
    }

    @PostMapping("/api/me/bookmark-folders")
    public ResponseEntity<BookmarkService.Folder> createFolder(@AuthenticationPrincipal Long me,
                                                               @RequestBody NameRequest req) {
        return ResponseEntity.status(201).body(bookmarks.createFolder(me, req.name()));
    }

    @PatchMapping("/api/me/bookmark-folders/{id}")
    public ResponseEntity<Void> renameFolder(@PathVariable long id, @AuthenticationPrincipal Long me,
                                             @RequestBody NameRequest req) {
        bookmarks.renameFolder(id, me, req.name());
        return ResponseEntity.ok().build();
    }

    /** 폴더만 지운다. 안의 책갈피는 미분류로 옮겨진다. */
    @DeleteMapping("/api/me/bookmark-folders/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable long id, @AuthenticationPrincipal Long me) {
        bookmarks.deleteFolder(id, me);
        return ResponseEntity.noContent().build();
    }
}
