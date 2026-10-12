package com.myblog.blog;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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

/**
 * 구독: 블로그 전체 또는 다이어리 한 권. 누르면 구독, 다시 누르면 취소. 내 블로그·다이어리와 비공개 다이어리는 안 되고,
 * 새 글은 구독한 블로그·다이어리에서 내가 볼 수 있는 글만 (구독자만 글 포함).
 */
class SubscriptionIT extends IntegrationTest {

    private void toggleDiary(long categoryId, MockHttpSession s, boolean expected, long count) throws Exception {
        mvc.perform(put("/api/categories/" + categoryId + "/subscribe").with(csrf()).session(s))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(expected))
                .andExpect(jsonPath("$.subscriberCount").value(count));
    }

    private long newDiary(MockHttpSession owner, String name, String visibility) throws Exception {
        long blog = blogIdOf(owner);
        long id = read(mvc.perform(postJson("/api/blogs/" + blog + "/categories", Map.of("name", name)).session(owner))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
        if (!"PUBLIC".equals(visibility)) {
            setDiaryVisibility(owner, id, visibility);
        }
        return id;
    }

    private void setDiaryVisibility(MockHttpSession owner, long id, String visibility) throws Exception {
        mvc.perform(jsonRequest(patch("/api/categories/" + id), Map.of("visibility", visibility)).session(owner))
                .andExpect(status().isOk());
    }

    private long writeIn(MockHttpSession s, long categoryId, String title, String visibility) throws Exception {
        long blogId = blogIdOf(s);
        var payload = new HashMap<String, Object>();
        payload.put("title", title);
        payload.put("body", "본문");
        payload.put("categoryId", categoryId);
        payload.put("visibility", visibility);
        return read(mvc.perform(postJson("/api/blogs/" + blogId + "/posts", payload).session(s))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
    }

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

    @Test
    void diaryToggleAndRules() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        MockHttpSession c = member("씨이", "c@example.com");
        long blogA = blogIdOf(a);
        long diary = newDiary(a, "여행", "PUBLIC");

        toggleDiary(diary, b, true, 1);
        toggleDiary(diary, c, true, 2);
        // 다이어리 목록에 구독자 수와 내가 구독했는지
        mvc.perform(get("/api/blogs/" + blogA + "/categories").session(b))
                .andExpect(jsonPath("$[1].id").value(diary))
                .andExpect(jsonPath("$[1].subscriberCount").value(2))
                .andExpect(jsonPath("$[1].subscribedByMe").value(true))
                .andExpect(jsonPath("$[0].subscriberCount").value(0))
                .andExpect(jsonPath("$[0].subscribedByMe").value(false));
        mvc.perform(get("/api/blogs/" + blogA + "/categories"))
                .andExpect(jsonPath("$[1].subscribedByMe").value(false));
        // 다이어리 구독은 블로그 구독자 수에 들어가지 않는다
        mvc.perform(get("/api/blogs/" + blogA)).andExpect(jsonPath("$.subscriberCount").value(0));
        toggleDiary(diary, c, false, 1);

        // 내 다이어리는 구독할 수 없다
        mvc.perform(put("/api/categories/" + diary + "/subscribe").with(csrf()).session(a))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("OWN_DIARY"));
        // 없는 다이어리, 로그인 필요
        mvc.perform(put("/api/categories/99999/subscribe").with(csrf()).session(b)).andExpect(status().isNotFound());
        mvc.perform(put("/api/categories/" + diary + "/subscribe").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/subscriptions/diaries")).andExpect(status().isUnauthorized());

        // 비공개로 바꾸면 그 다이어리의 구독은 해제되고, 비공개 다이어리는 구독할 수 없다
        setDiaryVisibility(a, diary, "PRIVATE");
        mvc.perform(get("/api/me/subscriptions/diaries").session(b)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(put("/api/categories/" + diary + "/subscribe").with(csrf()).session(b))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("PRIVATE_DIARY"));
        setDiaryVisibility(a, diary, "PUBLIC");
        mvc.perform(get("/api/blogs/" + blogA + "/categories").session(b))
                .andExpect(jsonPath("$[1].subscriberCount").value(0))
                .andExpect(jsonPath("$[1].subscribedByMe").value(false));
    }

    @Test
    void feedKindsAndDiaryList() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        MockHttpSession d = member("디이", "d@example.com");
        long blogA = blogIdOf(a);
        long travel = newDiary(a, "여행", "PUBLIC");
        long food = newDiary(a, "맛집", "PUBLIC");
        long t1 = writeIn(a, travel, "여행 글", "PUBLIC");
        writeIn(a, travel, "여행 비밀 글", "PRIVATE");
        long f1 = writeIn(a, food, "맛집 글", "PUBLIC");
        long b1 = writePost(b, "비이 글", "본문", "PUBLIC");
        long t2 = writeIn(a, travel, "여행 둘째 글", "PUBLIC");

        // 다이어리 하나만 구독: 그 다이어리 글만
        toggleDiary(travel, d, true, 1);
        mvc.perform(get("/api/me/subscriptions/posts").param("kind", "diary").session(d))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].id").value(t2))
                .andExpect(jsonPath("$.items[1].id").value(t1));
        mvc.perform(get("/api/me/subscriptions/posts").param("kind", "blog").session(d))
                .andExpect(jsonPath("$.totalItems").value(0));
        mvc.perform(get("/api/me/subscriptions/diaries").session(d))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(travel))
                .andExpect(jsonPath("$[0].name").value("여행"))
                .andExpect(jsonPath("$[0].blog.id").value(blogA))
                .andExpect(jsonPath("$[0].blog.name").value("에이의 블로그"))
                .andExpect(jsonPath("$[0].postCount").value(2));

        // 같은 블로그도 구독하면 전체에서 겹치는 글은 한 번만, 최신순
        toggle(blogA, d, true, 1);
        toggle(blogIdOf(b), d, true, 1);
        mvc.perform(get("/api/me/subscriptions/posts").session(d))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items[0].id").value(t2))
                .andExpect(jsonPath("$.items[1].id").value(b1))
                .andExpect(jsonPath("$.items[2].id").value(f1))
                .andExpect(jsonPath("$.items[3].id").value(t1));
        mvc.perform(get("/api/me/subscriptions/posts").param("kind", "all").session(d))
                .andExpect(jsonPath("$.totalItems").value(4));
        mvc.perform(get("/api/me/subscriptions/posts").param("kind", "blog").session(d))
                .andExpect(jsonPath("$.totalItems").value(4));
        mvc.perform(get("/api/me/subscriptions/posts").param("kind", "diary").session(d))
                .andExpect(jsonPath("$.totalItems").value(2));
    }

    @Test
    void popularDiariesBySubscribers() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession b = member("비이", "b@example.com");
        MockHttpSession c = member("씨이", "c@example.com");
        long hot = newDiary(a, "조회 많은", "PUBLIC");
        long loved = newDiary(a, "구독 많은", "PUBLIC");
        long p = writeIn(a, hot, "많이 본 글", "PUBLIC");
        writeIn(a, loved, "덜 본 글", "PUBLIC");
        jdbc.sql("UPDATE posts SET view_count = 100 WHERE id = ?").param(p).update();

        mvc.perform(get("/api/home")).andExpect(jsonPath("$.popularDiaries[0].id").value(hot));
        toggleDiary(loved, b, true, 1);
        toggleDiary(loved, c, true, 2);
        // 구독자 수가 먼저, 같으면 인기 점수 합계
        mvc.perform(get("/api/home"))
                .andExpect(jsonPath("$.popularDiaries[0].id").value(loved))
                .andExpect(jsonPath("$.popularDiaries[0].subscriberCount").value(2))
                .andExpect(jsonPath("$.popularDiaries[1].id").value(hot))
                .andExpect(jsonPath("$.popularDiaries[1].subscriberCount").value(0));
    }

    @Test
    void subscribersOnlyPostsAndDiaries() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");
        MockHttpSession sub = member("구독자", "s@example.com");
        MockHttpSession diarySub = member("다구독", "ds@example.com");
        MockHttpSession other = member("남이", "o@example.com");
        long blogA = blogIdOf(a);
        long open = newDiary(a, "열린", "PUBLIC");
        long closed = newDiary(a, "구독자방", "SUBSCRIBERS");
        long subPost = writeIn(a, open, "구독자만 단풍", "SUBSCRIBERS");
        long inClosed = writeIn(a, closed, "구독자 다이어리 단풍", "PUBLIC");
        long pub = writeIn(a, open, "모두 보는 단풍", "PUBLIC");
        String topic = read(mvc.perform(get("/api/posts/" + pub)).andReturn()).get("topic").get("code").asText();

        toggle(blogA, sub, true, 1);
        toggleDiary(open, diarySub, true, 1);

        // 구독하지 않은 사람·로그인 안 한 사람에게는 없는 글
        for (long id : new long[] {subPost, inClosed}) {
            mvc.perform(get("/api/posts/" + id)).andExpect(status().isNotFound());
            mvc.perform(get("/api/posts/" + id).session(other)).andExpect(status().isNotFound());
            mvc.perform(put("/api/posts/" + id + "/like").with(csrf()).session(other)).andExpect(status().isNotFound());
        }
        // 블로그 구독자는 둘 다, 다이어리 구독자는 그 다이어리의 구독자만 글만, 주인은 전부
        mvc.perform(get("/api/posts/" + subPost).session(sub)).andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("SUBSCRIBERS"));
        mvc.perform(get("/api/posts/" + inClosed).session(sub)).andExpect(status().isOk());
        mvc.perform(get("/api/posts/" + subPost).session(diarySub)).andExpect(status().isOk());
        mvc.perform(get("/api/posts/" + inClosed).session(diarySub)).andExpect(status().isNotFound());
        mvc.perform(get("/api/posts/" + inClosed).session(a)).andExpect(status().isOk());

        // 블로그 화면: 구독자만 다이어리는 구독자에게만 보이고, 글 수도 볼 수 있는 글만
        mvc.perform(get("/api/blogs/" + blogA + "/categories").session(other)).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/blogs/" + blogA + "/categories").session(sub))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[2].visibility").value("SUBSCRIBERS"))
                .andExpect(jsonPath("$[1].postCount").value(2));
        mvc.perform(get("/api/blogs/" + blogA)).andExpect(jsonPath("$.postCount").value(1));
        mvc.perform(get("/api/blogs/" + blogA).session(sub)).andExpect(jsonPath("$.postCount").value(3));
        mvc.perform(get("/api/blogs/" + blogA + "/posts").session(other)).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/blogs/" + blogA + "/posts").session(sub)).andExpect(jsonPath("$.totalItems").value(3));

        // 메인·분야·검색·주제 화면에는 나오지 않는다 (구독자에게도)
        mvc.perform(get("/api/home").session(sub))
                .andExpect(jsonPath("$.latestPosts.length()").value(1))
                .andExpect(jsonPath("$.latestPosts[0].id").value(pub))
                .andExpect(jsonPath("$.popularDiaries.length()").value(1))
                .andExpect(jsonPath("$.popularDiaries[0].id").value(open));
        mvc.perform(get("/api/posts").session(sub)).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/posts").param("topic", topic).session(sub)).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/topics/" + topic).session(sub)).andExpect(jsonPath("$.postCount").value(1));
        mvc.perform(get("/api/search").param("q", "단풍").session(sub))
                .andExpect(jsonPath("$.posts.totalItems").value(1))
                .andExpect(jsonPath("$.posts.items[0].id").value(pub));

        // 구독 피드에는 나온다
        mvc.perform(get("/api/me/subscriptions/posts").session(sub)).andExpect(jsonPath("$.totalItems").value(3));
        mvc.perform(get("/api/me/subscriptions/posts").session(diarySub))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].id").value(pub))
                .andExpect(jsonPath("$.items[1].id").value(subPost));

        // 구독자만 다이어리는 블로그 구독자만 구독할 수 있다
        mvc.perform(put("/api/categories/" + closed + "/subscribe").with(csrf()).session(other))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("SUBSCRIBERS_ONLY_DIARY"));
        toggleDiary(closed, sub, true, 1);
        mvc.perform(get("/api/me/subscriptions/diaries").session(sub))
                .andExpect(jsonPath("$[0].id").value(closed))
                .andExpect(jsonPath("$[0].postCount").value(1));
        // 블로그 구독을 끊어도 다이어리 구독으로 계속 보이고, 다이어리 구독 취소는 언제나 된다
        toggle(blogA, sub, false, 0);
        mvc.perform(get("/api/posts/" + inClosed).session(sub)).andExpect(status().isOk());
        mvc.perform(get("/api/posts/" + subPost).session(sub)).andExpect(status().isNotFound());
        toggleDiary(closed, sub, false, 0);
        mvc.perform(get("/api/posts/" + inClosed).session(sub)).andExpect(status().isNotFound());

        // 잘못된 공개 범위
        mvc.perform(jsonRequest(patch("/api/categories/" + open), Map.of("visibility", "FRIENDS")).session(a))
                .andExpect(status().isBadRequest());
    }
}
