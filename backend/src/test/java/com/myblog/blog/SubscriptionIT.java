package com.myblog.blog;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

/** 구독: 누르면 구독, 다시 누르면 취소. 내 블로그는 안 되고, 새 글은 구독한 블로그의 공개 글만. */
class SubscriptionIT extends IntegrationTest {

    private void toggle(long blogId, MockHttpSession s, boolean expected, long count) throws Exception {
        mvc.perform(put("/api/blogs/" + blogId + "/subscribe").with(csrf()).session(s))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(expected))
                .andExpect(jsonPath("$.subscriberCount").value(count));
    }

    @Test
    void toggleAndCounts() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        MockHttpSession c = member("씨이", "c@example.com");
        long blogA = blogIdOf(a);

        toggle(blogA, b, true, 1);
        toggle(blogA, c, true, 2);
        mvc.perform(get("/api/blogs/" + blogA).session(b))
                .andExpect(jsonPath("$.subscriberCount").value(2))
                .andExpect(jsonPath("$.subscribedByMe").value(true));
        mvc.perform(get("/api/blogs/" + blogA))
                .andExpect(jsonPath("$.subscriberCount").value(2))
                .andExpect(jsonPath("$.subscribedByMe").value(false));

        toggle(blogA, b, false, 1);
        mvc.perform(get("/api/blogs/" + blogA).session(b)).andExpect(jsonPath("$.subscribedByMe").value(false));

        // 내 블로그는 구독할 수 없다
        mvc.perform(put("/api/blogs/" + blogA + "/subscribe").with(csrf()).session(a))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("OWN_BLOG"));
        // 없는 블로그
        mvc.perform(put("/api/blogs/99999/subscribe").with(csrf()).session(b)).andExpect(status().isNotFound());
        // 로그인해야 한다
        mvc.perform(put("/api/blogs/" + blogA + "/subscribe").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/subscriptions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/subscriptions/posts")).andExpect(status().isUnauthorized());
    }

    @Test
    void feedAndList() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        MockHttpSession c = member("씨이", "c@example.com");
        MockHttpSession d = member("디이", "d@example.com");
        long blogA = blogIdOf(a);
        long blogB = blogIdOf(b);
        long first = writePost(a, "에이 첫 글", "본문", "PUBLIC");
        writePost(a, "에이 비밀 글", "본문", "PRIVATE");
        writePost(c, "구독 안 한 블로그 글", "본문", "PUBLIC");
        long second = writePost(b, "비이 글", "본문", "PUBLIC");
        writePost(d, "내 글", "본문", "PUBLIC");

        mvc.perform(get("/api/me/subscriptions/posts").session(d)).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get("/api/me/subscriptions").session(d)).andExpect(jsonPath("$.length()").value(0));

        toggle(blogA, d, true, 1);
        toggle(blogB, d, true, 1);

        // 구독한 블로그의 공개 글만, 최신순
        mvc.perform(get("/api/me/subscriptions/posts").session(d))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].id").value(second))
                .andExpect(jsonPath("$.items[1].id").value(first));

        // 구독한 블로그: 최근에 구독한 것부터
        mvc.perform(get("/api/me/subscriptions").session(d))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(blogB))
                .andExpect(jsonPath("$[0].ownerNickname").value("비이"))
                .andExpect(jsonPath("$[0].lastPostAt").isNotEmpty())
                .andExpect(jsonPath("$[1].id").value(blogA))
                .andExpect(jsonPath("$[1].name").value("에이의 블로그"));

        // 구독을 취소하면 그 블로그 글은 빠진다
        toggle(blogB, d, false, 0);
        mvc.perform(get("/api/me/subscriptions/posts").session(d))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first));
    }
}
