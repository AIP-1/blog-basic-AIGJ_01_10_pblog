package com.myblog.home;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;

/** 메인: 분야별 글(주제 · 정렬), 이번 주 인기 글, 인기 다이어리, 글 카드의 좋아요·댓글 수. */
class HomeFeedIT extends IntegrationTest {

    @Test
    void feedPopularAndCounts() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        long quiet = writePost(a, "조용한 글", "본문", "PUBLIC");
        long hot = writePost(a, "인기 글", "본문", "PUBLIC");
        writePost(a, "비공개 글", "본문", "PRIVATE");
        long newest = writePost(a, "최신 글", "본문", "PUBLIC");

        mvc.perform(put("/api/posts/" + hot + "/like").with(SecurityMockMvcRequestPostProcessors.csrf()).session(b))
                .andExpect(status().isOk());
        mvc.perform(postJson("/api/posts/" + hot + "/comments", Map.of("body", "좋아요")).session(b))
                .andExpect(status().is2xxSuccessful());

        // 최신순: 공개 글만, 최신 글부터
        mvc.perform(get("/api/posts")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[0].id").value(newest));
        // 인기순: 좋아요·댓글 받은 글이 먼저, 카드에 수가 실린다
        mvc.perform(get("/api/posts").param("sort", "popular"))
                .andExpect(jsonPath("$.items[0].id").value(hot))
                .andExpect(jsonPath("$.items[0].likeCount").value(1))
                .andExpect(jsonPath("$.items[0].commentCount").value(1))
                .andExpect(jsonPath("$.items[0].authorNickname").value("에이"));
        // 주제로 거르기: 가입 블로그의 기본 주제(hobby)만 있다
        mvc.perform(get("/api/posts").param("topic", "hobby")).andExpect(jsonPath("$.totalItems").value(3));
        mvc.perform(get("/api/posts").param("topic", "travel")).andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get("/api/posts").param("topic", "nope")).andExpect(status().isNotFound());

        mvc.perform(get("/api/home")).andExpect(status().isOk())
                .andExpect(jsonPath("$.weeklyPopular[0].id").value(hot))
                .andExpect(jsonPath("$.weeklyPopular.length()").value(3))
                .andExpect(jsonPath("$.popularPosts.length()").value(3))
                .andExpect(jsonPath("$.popularDiaries[0].blog.id").value(blogIdOf(a)))
                .andExpect(jsonPath("$.popularDiaries[0].postCount").value(3));
        mvc.perform(get("/api/posts/" + quiet)).andExpect(jsonPath("$.title").value("조용한 글"))
                .andExpect(jsonPath("$.viewCount").isNumber())
                .andExpect(jsonPath("$.category.colorIndex").isNumber());
    }
}
