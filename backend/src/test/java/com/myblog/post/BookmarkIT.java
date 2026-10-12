package com.myblog.post;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;

/** 책갈피: 누르면 저장, 다시 누르면 빼기. 내 책갈피는 최근 저장 순, 볼 수 없는 글은 빠진다. */
class BookmarkIT extends IntegrationTest {

    private void toggle(long postId, MockHttpSession s, boolean expected) throws Exception {
        mvc.perform(put("/api/posts/" + postId + "/bookmark").with(SecurityMockMvcRequestPostProcessors.csrf()).session(s))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bookmarked").value(expected));
    }

    @Test
    void bookmarks() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        long first = writePost(a, "첫 글", "본문", "PUBLIC");
        long second = writePost(a, "둘째 글", "본문", "PUBLIC");
        long secret = writePost(a, "비밀 글", "본문", "PRIVATE");

        toggle(first, b, true);
        toggle(second, b, true);
        mvc.perform(get("/api/posts/" + first).session(b)).andExpect(jsonPath("$.bookmarkedByMe").value(true));
        mvc.perform(get("/api/me/bookmarks").session(b)).andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].id").value(second));

        toggle(second, b, false);
        mvc.perform(get("/api/me/bookmarks").session(b)).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first));

        // 남의 비공개 글은 책갈피할 수 없다
        mvc.perform(put("/api/posts/" + secret + "/bookmark").with(SecurityMockMvcRequestPostProcessors.csrf()).session(b))
                .andExpect(status().isNotFound());
        // 로그인해야 한다
        mvc.perform(get("/api/me/bookmarks")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/posts/" + first)).andExpect(jsonPath("$.bookmarkedByMe").value(false));
    }
}
