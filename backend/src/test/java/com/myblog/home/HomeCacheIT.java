package com.myblog.home;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;

/** 메인 · 분야별 글 응답 캐시: 다시 열면 캐시를 쓰고, 글을 쓰거나 지우면 바로 새로 읽는다. */
@TestPropertySource(properties = "myblog.home.cache-ttl=30s")
class HomeCacheIT extends IntegrationTest {

    @Test
    void cachedUntilPostsChange() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        long first = writePost(a, "첫 글", "본문", "PUBLIC");

        mvc.perform(get("/api/home")).andExpect(jsonPath("$.latestPosts.length()").value(1));
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.totalItems").value(1));

        // 서비스를 거치지 않고 DB만 바꾸면 캐시가 그대로 나온다 (= 캐시를 쓰고 있다)
        jdbc.sql("UPDATE posts SET title = '몰래 바꾼 제목' WHERE id = ?").param(first).update();
        mvc.perform(get("/api/home")).andExpect(jsonPath("$.latestPosts[0].title").value("첫 글"));

        // 글을 쓰면 캐시를 버리고 새 글과 바뀐 제목이 함께 보인다
        long second = writePost(a, "둘째 글", "본문", "PUBLIC");
        mvc.perform(get("/api/home")).andExpect(jsonPath("$.latestPosts.length()").value(2))
                .andExpect(jsonPath("$.latestPosts[0].id").value(second))
                .andExpect(jsonPath("$.latestPosts[1].title").value("몰래 바꾼 제목"));
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.totalItems").value(2));

        // 지워도 바로 빠진다
        mvc.perform(delete("/api/posts/" + second).with(SecurityMockMvcRequestPostProcessors.csrf()).session(a))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get("/api/home")).andExpect(jsonPath("$.latestPosts.length()").value(1));
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.totalItems").value(1));
    }

    /** Redis가 비어도(꺼진 것과 같은 상황의 첫 요청) 같은 모양으로 응답한다. */
    @Test
    void sameShapeFromCache() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        writePost(a, "글", "본문", "PUBLIC");
        String fresh = mvc.perform(get("/api/home")).andReturn().getResponse().getContentAsString();
        String cached = mvc.perform(get("/api/home")).andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(json.readTree(cached)).isEqualTo(json.readTree(fresh));
    }
}
