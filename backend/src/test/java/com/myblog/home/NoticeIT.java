package com.myblog.home;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.TestPropertySource;

/** 공지사항: 공지 담당 회원 블로그의 '공지' 다이어리 공개 글만 최신순으로 나온다. */
@TestPropertySource(properties = "myblog.notice.owner-email= Notice@Example.com ")
class NoticeIT extends IntegrationTest {

    private long write(MockHttpSession s, long category, String title, String visibility) throws Exception {
        var m = new HashMap<String, Object>();
        m.put("title", title);
        m.put("body", "본문");
        m.put("categoryId", category);
        m.put("visibility", visibility);
        return read(mvc.perform(postJson("/api/blogs/" + blogIdOf(s) + "/posts", m).session(s))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
    }

    @Test
    void noticesComeFromOwnersNoticeDiaryOnly() throws Exception {
        mvc.perform(get("/api/notices")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.totalItems").value(0));

        MockHttpSession owner = member("운영자", "notice@example.com");
        MockHttpSession other = member("다른이", "other@example.com");
        long blog = blogIdOf(owner);
        long notice = read(mvc.perform(postJson("/api/blogs/" + blog + "/categories", Map.of("name", "공지"))
                .session(owner)).andReturn()).get("id").asLong();
        long normal = defaultCategory(blog);
        long otherNoticeCat = read(mvc.perform(postJson("/api/blogs/" + blogIdOf(other) + "/categories",
                Map.of("name", "공지")).session(other)).andReturn()).get("id").asLong();

        write(owner, notice, "v1.0 바뀐 점", "PUBLIC");
        write(owner, notice, "비공개 공지", "PRIVATE");
        write(owner, normal, "그냥 글", "PUBLIC");
        write(other, otherNoticeCat, "다른 사람 공지", "PUBLIC");
        write(owner, notice, "v1.1 바뀐 점", "PUBLIC");

        mvc.perform(get("/api/notices")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].title").value("v1.1 바뀐 점"))
                .andExpect(jsonPath("$.items[1].title").value("v1.0 바뀐 점"))
                .andExpect(jsonPath("$.items[0].blog.id").value(blog));
        mvc.perform(get("/api/home")).andExpect(status().isOk())
                .andExpect(jsonPath("$.notices.length()").value(2))
                .andExpect(jsonPath("$.notices[0].title").value("v1.1 바뀐 점"));

        // 공지 다이어리를 비공개로 바꾸면 공지에서도 빠진다
        mvc.perform(jsonRequest(patch("/api/categories/" + notice), Map.of("visibility", "PRIVATE")).session(owner))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get("/api/notices")).andExpect(jsonPath("$.totalItems").value(0));
    }
}
