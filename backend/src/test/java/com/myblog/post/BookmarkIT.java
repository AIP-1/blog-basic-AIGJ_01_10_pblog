package com.myblog.post;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 책갈피 (데모 '저장'): 폴더를 골라 꽂고, 이미 꽂은 글이면 폴더만 옮긴다. 빼기는 따로.
 * 내 책갈피는 최근 순, 폴더로 거르고(전체 · 미분류 · 폴더), 볼 수 없는 글은 빠진다.
 */
class BookmarkIT extends IntegrationTest {

    private ResultActions save(long postId, MockHttpSession s, Long folderId) throws Exception {
        Map<String, Object> req = new HashMap<>();
        req.put("folderId", folderId);
        return mvc.perform(jsonRequest(put("/api/posts/" + postId + "/bookmark"), req).session(s));
    }

    private long folder(MockHttpSession s, String name) throws Exception {
        var r = mvc.perform(postJson("/api/me/bookmark-folders", Map.of("name", name)).session(s))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value(name))
                .andExpect(jsonPath("$.count").value(0)).andReturn();
        return read(r).get("id").asLong();
    }

    @Test
    void bookmarks() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        long first = writePost(a, "첫 글", "본문", "PUBLIC");
        long second = writePost(a, "둘째 글", "본문", "PUBLIC");
        long secret = writePost(a, "비밀 글", "본문", "PRIVATE");

        // 몸통 없이 보내면 미분류에 꽂힌다
        mvc.perform(put("/api/posts/" + first + "/bookmark").with(csrf()).session(b)).andExpect(status().isOk())
                .andExpect(jsonPath("$.folderId").doesNotExist());
        save(second, b, null).andExpect(status().isOk());
        mvc.perform(get("/api/posts/" + first).session(b)).andExpect(jsonPath("$.bookmarkedByMe").value(true))
                .andExpect(jsonPath("$.bookmark.folderId").doesNotExist());
        mvc.perform(get("/api/me/bookmarks").session(b)).andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].id").value(second))
                .andExpect(jsonPath("$.items[0].savedAt").isString());

        mvc.perform(delete("/api/posts/" + second + "/bookmark").with(csrf()).session(b))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/bookmarks").session(b)).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first));
        mvc.perform(get("/api/posts/" + second).session(b)).andExpect(jsonPath("$.bookmarkedByMe").value(false))
                .andExpect(jsonPath("$.bookmark").doesNotExist());

        // 남의 비공개 글은 꽂을 수 없다
        save(secret, b, null).andExpect(status().isNotFound());
        // 로그인해야 한다
        mvc.perform(get("/api/me/bookmarks")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/bookmark-folders")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/posts/" + first)).andExpect(jsonPath("$.bookmarkedByMe").value(false));
    }

    @Test
    void folders() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        long first = writePost(a, "첫 글", "본문", "PUBLIC");
        long second = writePost(a, "둘째 글", "본문", "PUBLIC");
        long third = writePost(a, "셋째 글", "본문", "PUBLIC");

        long recipes = folder(b, "요리");
        long trips = folder(b, "여행");
        // 이름 규칙: 비우면 안 되고, 탭 이름(전체 · 미분류)은 못 쓰고, 20자까지, 내 폴더끼리 겹치면 안 된다
        mvc.perform(postJson("/api/me/bookmark-folders", Map.of("name", "  ")).session(b))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.message").value("폴더 이름을 입력해 주세요"));
        mvc.perform(postJson("/api/me/bookmark-folders", Map.of("name", "미분류")).session(b))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/me/bookmark-folders", Map.of("name", "가".repeat(21))).session(b))
                .andExpect(status().isBadRequest());
        mvc.perform(postJson("/api/me/bookmark-folders", Map.of("name", " 요리 ")).session(b))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("BOOKMARK_FOLDER_NAME_TAKEN"));
        long others = folder(a, "요리"); // 다른 회원은 같은 이름을 써도 된다

        save(first, b, recipes).andExpect(status().isOk()).andExpect(jsonPath("$.folderId").value(recipes))
                .andExpect(jsonPath("$.folderName").value("요리"));
        save(second, b, recipes).andExpect(status().isOk());
        save(third, b, null).andExpect(status().isOk());
        // 이미 꽂은 글이면 폴더만 옮긴다 (꽂은 시각은 그대로)
        save(second, b, trips).andExpect(status().isOk()).andExpect(jsonPath("$.folderName").value("여행"));
        mvc.perform(get("/api/posts/" + second).session(b)).andExpect(jsonPath("$.bookmark.folderId").value(trips));
        // 남의 폴더에는 못 꽂는다
        save(first, b, others).andExpect(status().isNotFound());

        mvc.perform(get("/api/me/bookmark-folders").session(b)).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.none").value(1))
                .andExpect(jsonPath("$.folders.length()").value(2))
                .andExpect(jsonPath("$.folders[0].name").value("요리")).andExpect(jsonPath("$.folders[0].count").value(1))
                .andExpect(jsonPath("$.folders[1].name").value("여행")).andExpect(jsonPath("$.folders[1].count").value(1));
        mvc.perform(get("/api/me/bookmarks").param("folder", "none").session(b))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].id").value(third));
        mvc.perform(get("/api/me/bookmarks").param("folder", String.valueOf(trips)).session(b))
                .andExpect(jsonPath("$.totalItems").value(1)).andExpect(jsonPath("$.items[0].id").value(second))
                .andExpect(jsonPath("$.items[0].folderId").value(trips));
        mvc.perform(get("/api/me/bookmarks").param("folder", "all").session(b))
                .andExpect(jsonPath("$.totalItems").value(3));
        mvc.perform(get("/api/me/bookmarks").param("folder", String.valueOf(others)).session(b))
                .andExpect(status().isNotFound());

        // 이름 바꾸기
        mvc.perform(jsonRequest(patch("/api/me/bookmark-folders/" + trips), Map.of("name", "요리")).session(b))
                .andExpect(status().isConflict());
        mvc.perform(jsonRequest(patch("/api/me/bookmark-folders/" + trips), Map.of("name", "가 볼 곳")).session(b))
                .andExpect(status().isOk());
        mvc.perform(jsonRequest(patch("/api/me/bookmark-folders/" + others), Map.of("name", "남의 것")).session(b))
                .andExpect(status().isNotFound());

        // 폴더를 지우면 안의 글은 미분류로 (글은 그대로)
        mvc.perform(delete("/api/me/bookmark-folders/" + recipes).with(csrf()).session(b))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/bookmark-folders").session(b))
                .andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.none").value(2))
                .andExpect(jsonPath("$.folders.length()").value(1))
                .andExpect(jsonPath("$.folders[0].name").value("가 볼 곳"));
        mvc.perform(get("/api/posts/" + first).session(b)).andExpect(jsonPath("$.bookmarkedByMe").value(true))
                .andExpect(jsonPath("$.bookmark.folderId").doesNotExist());
        mvc.perform(delete("/api/me/bookmark-folders/" + others).with(csrf()).session(b))
                .andExpect(status().isNotFound());

        // 비공개로 바뀐 글은 목록과 개수에서 빠진다
        jdbc.sql("UPDATE posts SET visibility = 'PRIVATE' WHERE id = ?").param(third).update();
        mvc.perform(get("/api/me/bookmark-folders").session(b))
                .andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.none").value(1));
    }

    /** 인기 점수에 책갈피 ×4 (글쓴이 본인 것은 빼고) */
    @Test
    void popularity() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        long kept = writePost(a, "꽂힌 글", "본문", "PUBLIC");
        long own = writePost(a, "내가 꽂은 글", "본문", "PUBLIC");
        long newest = writePost(a, "새 글", "본문", "PUBLIC");
        save(kept, b, null).andExpect(status().isOk());
        save(own, a, null).andExpect(status().isOk());

        mvc.perform(get("/api/posts").param("sort", "popular"))
                .andExpect(jsonPath("$.items[0].id").value(kept))
                .andExpect(jsonPath("$.items[1].id").value(newest))
                .andExpect(jsonPath("$.items[2].id").value(own));
    }
}
