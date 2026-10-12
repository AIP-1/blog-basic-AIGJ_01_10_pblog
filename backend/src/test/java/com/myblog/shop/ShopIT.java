package com.myblog.shop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.common.error.ApiException;
import com.myblog.support.IntegrationTest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpSession;

/** 스티커 상점: 잉크 적립 한도, 팩 사기, 도전과제 보상, 다이어리 표지 스티커 */
class ShopIT extends IntegrationTest {

    @Autowired
    StickerService stickerService;

    private int balance(MockHttpSession s) throws Exception {
        return read(mvc.perform(get("/api/me/ink").session(s)).andExpect(status().isOk()).andReturn())
                .get("balance").asInt();
    }

    private void setBalance(long memberId, int balance) {
        jdbc.sql("""
                INSERT INTO ink_wallets (member_id, balance, updated_at) VALUES (?, ?, now())
                ON CONFLICT (member_id) DO UPDATE SET balance = EXCLUDED.balance""").params(memberId, balance).update();
    }

    private void comment(MockHttpSession s, long memberId, long postId) throws Exception {
        redis.delete("comment:cooldown:" + memberId); // 5초 쿨다운을 건너뛴다
        mvc.perform(postJson("/api/posts/" + postId + "/comments", Map.of("body", "좋은 글")).session(s))
                .andExpect(status().isCreated());
    }

    @Test
    void earningRulesHaveDailyCaps() throws Exception {
        long aId = signup("에이", "a@example.com");
        MockHttpSession a = login("a@example.com", PASSWORD);
        long bId = signup("비이", "b@example.com");
        MockHttpSession b = login("b@example.com", PASSWORD);

        // 출석은 하루 한 번
        mvc.perform(post("/api/shop/checkin").with(csrf()).session(a))
                .andExpect(jsonPath("$.earned").value(10)).andExpect(jsonPath("$.streak").value(1));
        mvc.perform(post("/api/shop/checkin").with(csrf()).session(a))
                .andExpect(jsonPath("$.earned").value(0)).andExpect(jsonPath("$.balance").value(10));
        mvc.perform(post("/api/shop/checkin").with(csrf())).andExpect(status().isUnauthorized());

        // 비공개 글은 잉크 없음, 공개 글은 하루 3번까지
        writePost(a, "비밀", "본문", "PRIVATE");
        assertThat(balance(a)).isEqualTo(10);
        long first = writePost(a, "하나", "본문", "PUBLIC");
        writePost(a, "둘", "본문", "PUBLIC");
        assertThat(balance(a)).isEqualTo(50);
        // 수정해도 더 주지 않는다
        long cat = defaultCategory(blogIdOf(a));
        mvc.perform(jsonRequest(put("/api/posts/" + first), Map.of("title", "하나 고침", "body", "본문",
                "categoryId", cat, "visibility", "PUBLIC")).session(a)).andExpect(status().isOk());
        assertThat(balance(a)).isEqualTo(50);
        // 지워도 돌려받지 않고, 지우고 다시 써도 한도는 그대로
        mvc.perform(delete("/api/posts/" + first).with(csrf()).session(a)).andExpect(status().isOk());
        writePost(a, "셋", "본문", "PUBLIC");
        assertThat(balance(a)).isEqualTo(70);
        writePost(a, "넷", "본문", "PUBLIC");
        assertThat(balance(a)).isEqualTo(70);
        mvc.perform(get("/api/me/ink").session(a))
                .andExpect(jsonPath("$.checkedInToday").value(true))
                .andExpect(jsonPath("$.earn.postsToday").value(3))
                .andExpect(jsonPath("$.history[0].reason").value("POST"))
                .andExpect(jsonPath("$.history[0].amount").value(20));

        // 댓글: 다른 사람 글에만, 하루 10번까지
        long bPost = writePost(b, "비의 글", "본문", "PUBLIC");
        int before = balance(a);
        for (int i = 0; i < 11; i++) {
            comment(a, aId, bPost);
        }
        assertThat(balance(a)).isEqualTo(before + 20);
        long bBefore = balance(b);
        comment(b, bId, bPost); // 내 글에 단 댓글
        assertThat(balance(b)).isEqualTo(bBefore);
    }

    @Test
    void buyingPacks() throws Exception {
        long aId = signup("에이", "a@example.com");
        MockHttpSession a = login("a@example.com", PASSWORD);

        // 로그인 안 해도 상점은 볼 수 있다
        mvc.perform(get("/api/shop/packs"))
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].stickers.length()").value(6))
                .andExpect(jsonPath("$[0].owned").value(false));
        mvc.perform(post("/api/shop/packs/stationery/buy").with(csrf())).andExpect(status().isUnauthorized());

        // 잉크가 모자라면 아무것도 바뀌지 않는다
        setBalance(aId, 30);
        mvc.perform(post("/api/shop/packs/stationery/buy").with(csrf()).session(a))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("INSUFFICIENT_INK"))
                .andExpect(jsonPath("$.error.message").value("잉크가 부족해요"));
        assertThat(balance(a)).isEqualTo(30);
        mvc.perform(get("/api/me/stickers").session(a)).andExpect(jsonPath("$.length()").value(0));

        setBalance(aId, 120);
        mvc.perform(post("/api/shop/packs/stationery/buy").with(csrf()).session(a))
                .andExpect(status().isOk()).andExpect(jsonPath("$.balance").value(70));
        mvc.perform(get("/api/me/stickers").session(a)).andExpect(jsonPath("$.length()").value(6));
        // 두 번은 못 산다
        mvc.perform(post("/api/shop/packs/stationery/buy").with(csrf()).session(a))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("ALREADY_OWNED"));
        assertThat(balance(a)).isEqualTo(70);
        mvc.perform(post("/api/shop/packs/nope/buy").with(csrf()).session(a)).andExpect(status().isNotFound());
        mvc.perform(get("/api/shop/packs").session(a))
                .andExpect(jsonPath("$[5].code").value("stationery"))
                .andExpect(jsonPath("$[5].owned").value(true));
        mvc.perform(get("/api/me/ink").session(a))
                .andExpect(jsonPath("$.history[0].reason").value("PURCHASE"))
                .andExpect(jsonPath("$.history[0].amount").value(-50))
                .andExpect(jsonPath("$.history[0].label").value("문구"));
    }

    @Test
    void concurrentPurchasesNeverOverdraw() throws Exception {
        long aId = signup("에이", "a@example.com");
        setBalance(aId, 100); // 일상(60)과 음식(80) 중 하나만 살 수 있다
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Callable<Boolean>> tasks = new ArrayList<>();
        for (String pack : List.of("daily", "food", "daily", "food")) {
            tasks.add(() -> {
                try {
                    stickerService.buy(aId, pack);
                    return true;
                } catch (ApiException e) {
                    return false;
                }
            });
        }
        int ok = 0;
        for (Future<Boolean> f : pool.invokeAll(tasks)) {
            ok += f.get() ? 1 : 0;
        }
        pool.shutdown();
        assertThat(ok).isEqualTo(1);
        int balance = jdbc.sql("SELECT balance FROM ink_wallets WHERE member_id = ?").param(aId).query(Integer.class).single();
        assertThat(balance).isIn(40, 20);
        long packs = jdbc.sql("SELECT count(*) FROM member_sticker_packs WHERE member_id = ?").param(aId)
                .query(Long.class).single();
        assertThat(packs).isEqualTo(1);
    }

    @Test
    void challengeRewardIsClaimedOnce() throws Exception {
        MockHttpSession a = member("에이", "a@example.com");

        mvc.perform(get("/api/shop/challenges"))
                .andExpect(jsonPath("$.length()").value(10))
                .andExpect(jsonPath("$[0].code").value("first-post"))
                .andExpect(jsonPath("$[0].progress").value(0));
        mvc.perform(post("/api/shop/challenges/first-post/claim").with(csrf()).session(a))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("CHALLENGE_NOT_DONE"));

        writePost(a, "첫 글", "본문", "PUBLIC"); // +20
        mvc.perform(get("/api/shop/challenges").session(a))
                .andExpect(jsonPath("$[0].completed").value(true))
                .andExpect(jsonPath("$[0].claimed").value(false))
                .andExpect(jsonPath("$[1].progress").value(1))
                .andExpect(jsonPath("$[1].goal").value(10));
        mvc.perform(post("/api/shop/challenges/first-post/claim").with(csrf()).session(a))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.earned").value(30))
                .andExpect(jsonPath("$.sticker.code").value("ltd-first-star"))
                .andExpect(jsonPath("$.balance").value(50));
        mvc.perform(post("/api/shop/challenges/first-post/claim").with(csrf()).session(a))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("ALREADY_CLAIMED"));
        assertThat(balance(a)).isEqualTo(50);
        mvc.perform(get("/api/me/stickers").session(a))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].limited").value(true));
        mvc.perform(get("/api/shop/challenges").session(a)).andExpect(jsonPath("$[0].claimed").value(true));
        mvc.perform(post("/api/shop/challenges/nope/claim").with(csrf()).session(a)).andExpect(status().isNotFound());

        // 소개 쓰기
        mvc.perform(jsonRequest(patch("/api/me"), Map.of("bio", "안녕하세요")).session(a)).andExpect(status().isOk());
        mvc.perform(post("/api/shop/challenges/bio/claim").with(csrf()).session(a)).andExpect(jsonPath("$.earned").value(20));
    }

    @Test
    void checkinStreakChallenges() throws Exception {
        long aId = signup("에이", "a@example.com");
        MockHttpSession a = login("a@example.com", PASSWORD);
        LocalDate today = LocalDate.now(com.myblog.common.KoreanClock.SEOUL);
        // 지난 6일 연속 출석 기록 + 그 전에 떨어진 하루
        for (int d = 1; d <= 6; d++) {
            jdbc.sql("""
                    INSERT INTO ink_ledger_entries (member_id, amount, reason, ref, earned_on, created_at)
                    VALUES (?, 10, 'CHECKIN', ?, ?, ?)""")
                    .params(aId, today.minusDays(d).toString(), today.minusDays(d), OffsetDateTime.now()).update();
        }
        jdbc.sql("""
                INSERT INTO ink_ledger_entries (member_id, amount, reason, ref, earned_on, created_at)
                VALUES (?, 10, 'CHECKIN', ?, ?, ?)""")
                .params(aId, today.minusDays(9).toString(), today.minusDays(9), OffsetDateTime.now()).update();
        mvc.perform(get("/api/me/ink").session(a)).andExpect(jsonPath("$.streak").value(6));
        mvc.perform(post("/api/shop/challenges/streak-7/claim").with(csrf()).session(a)).andExpect(status().isConflict());
        mvc.perform(post("/api/shop/checkin").with(csrf()).session(a)).andExpect(jsonPath("$.streak").value(7));
        mvc.perform(get("/api/shop/challenges").session(a))
                .andExpect(jsonPath("$[2].code").value("streak-7"))
                .andExpect(jsonPath("$[2].completed").value(true))
                .andExpect(jsonPath("$[9].progress").value(8));
        mvc.perform(post("/api/shop/challenges/streak-7/claim").with(csrf()).session(a))
                .andExpect(jsonPath("$.sticker.code").value("ltd-clover"));
    }

    @Test
    void diaryCoverStickers() throws Exception {
        long aId = signup("에이", "a@example.com");
        MockHttpSession a = login("a@example.com", PASSWORD);
        MockHttpSession b = member("비이", "b@example.com");
        long blog = blogIdOf(a);
        long cat = defaultCategory(blog);
        String url = "/api/categories/" + cat + "/stickers";

        // 가지지 않은 스티커는 못 붙인다
        mvc.perform(jsonRequest(put(url), Map.of("stickers", List.of(Map.of("slot", "TL", "code", "stat-pencil", "rotation", 0))))
                .session(a)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("STICKER_NOT_OWNED"));

        setBalance(aId, 500);
        mvc.perform(post("/api/shop/packs/stationery/buy").with(csrf()).session(a)).andExpect(status().isOk());
        mvc.perform(post("/api/shop/packs/animal/buy").with(csrf()).session(a)).andExpect(status().isOk());

        List<Map<String, Object>> three = List.of(
                Map.of("slot", "TL", "code", "stat-pencil", "rotation", -8),
                Map.of("slot", "BR", "code", "animal-cat", "rotation", 15),
                Map.of("slot", "C", "code", "stat-tape", "rotation", 0));
        mvc.perform(jsonRequest(put(url), Map.of("stickers", three)).session(a))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));

        // 4개, 같은 자리 두 번, 이상한 기울기는 안 된다
        var four = new ArrayList<>(three);
        four.add(Map.of("slot", "TR", "code", "animal-dog", "rotation", 0));
        mvc.perform(jsonRequest(put(url), Map.of("stickers", four)).session(a))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("TOO_MANY_STICKERS"));
        mvc.perform(jsonRequest(put(url), Map.of("stickers", List.of(
                Map.of("slot", "TL", "code", "stat-pencil", "rotation", 0),
                Map.of("slot", "TL", "code", "animal-cat", "rotation", 0)))).session(a))
                .andExpect(status().isBadRequest());
        var bad = new HashMap<String, Object>(Map.of("slot", "TL", "code", "stat-pencil", "rotation", 33));
        mvc.perform(jsonRequest(put(url), Map.of("stickers", List.of(bad))).session(a)).andExpect(status().isBadRequest());
        // 남의 다이어리는 못 꾸민다
        mvc.perform(jsonRequest(put(url), Map.of("stickers", List.of())).session(b)).andExpect(status().isNotFound());

        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(cat)))
                .andExpect(jsonPath("$['" + cat + "'].length()").value(3))
                .andExpect(jsonPath("$['" + cat + "'][0].slot").value("BR"))
                .andExpect(jsonPath("$['" + cat + "'][0].rotation").value(15));

        // 비공개 다이어리의 표지는 주인만 본다
        mvc.perform(jsonRequest(patch("/api/categories/" + cat), Map.of("visibility", "PRIVATE")).session(a))
                .andExpect(status().isOk());
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(cat)).session(b))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(cat)).session(a))
                .andExpect(jsonPath("$['" + cat + "'].length()").value(3));

        // 빈 목록이면 모두 뗀다
        mvc.perform(jsonRequest(put(url), Map.of("stickers", List.of())).session(a)).andExpect(status().isOk());
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(cat)).session(a))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void subscribersOnlyCoverStickersAndDiarySubscriptionChallenge() throws Exception {
        long aId = signup("에이", "a@example.com");
        MockHttpSession a = login("a@example.com", PASSWORD);
        MockHttpSession b = member("비이", "b@example.com");
        MockHttpSession c = member("씨이", "c@example.com");
        long blog = blogIdOf(a);
        long diary = read(mvc.perform(postJson("/api/blogs/" + blog + "/categories", Map.of("name", "구독자 일기")).session(a))
                .andReturn()).get("id").asLong();
        setBalance(aId, 100);
        mvc.perform(post("/api/shop/packs/stationery/buy").with(csrf()).session(a)).andExpect(status().isOk());
        mvc.perform(jsonRequest(put("/api/categories/" + diary + "/stickers"),
                Map.of("stickers", List.of(Map.of("slot", "C", "code", "stat-tape", "rotation", 0)))).session(a))
                .andExpect(status().isOk());

        // 공개 다이어리일 때 비가 구독한다 (다이어리 구독도 '첫 구독'으로 친다)
        mvc.perform(put("/api/categories/" + diary + "/subscribe").with(csrf()).session(b)).andExpect(status().isOk());
        mvc.perform(get("/api/shop/challenges").session(b))
                .andExpect(jsonPath("$[6].code").value("first-subscribe"))
                .andExpect(jsonPath("$[6].completed").value(true));
        mvc.perform(post("/api/shop/challenges/first-subscribe/claim").with(csrf()).session(b))
                .andExpect(jsonPath("$.earned").value(20));

        // 구독자만 다이어리: 구독자와 주인만 표지 스티커를 본다
        mvc.perform(jsonRequest(patch("/api/categories/" + diary), Map.of("visibility", "SUBSCRIBERS")).session(a))
                .andExpect(status().isOk());
        String key = "$['" + diary + "'].length()";
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(diary)).session(b))
                .andExpect(jsonPath(key).value(1));
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(diary)).session(a))
                .andExpect(jsonPath(key).value(1));
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(diary)).session(c))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/diary-stickers").param("categoryIds", String.valueOf(diary)))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
