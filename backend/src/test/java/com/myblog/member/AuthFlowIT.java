package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;

class AuthFlowIT extends IntegrationTest {

    private Map<String, Object> signupBody(String email) {
        return Map.of("nickname", "수연", "email", email, "password", PASSWORD, "passwordConfirm", PASSWORD);
    }

    @Test
    void CF_01_20_signupWithoutVerificationRejected() throws Exception {
        mvc.perform(postJson("/api/auth/signup", signupBody("a@b.com")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("NOT_VERIFIED"));
    }

    @Test
    void CF_03_2_signupCreatesBlogAndDefaultCategory_passwordHashed() throws Exception {
        long id = signup("수연", "Su@Example.com");
        var member = jdbc.sql("SELECT email, password_hash FROM members WHERE id = ?").param(id).query().singleRow();
        assertThat(member.get("email")).isEqualTo("su@example.com");
        assertThat((String) member.get("password_hash")).startsWith("$2").doesNotContain(PASSWORD);
        var blog = jdbc.sql("SELECT name FROM blogs WHERE owner_id = ?").param(id).query(String.class).single();
        assertThat(blog).isEqualTo("수연의 블로그");
        var cats = jdbc.sql("SELECT c.name FROM categories c JOIN blogs b ON b.id = c.blog_id WHERE b.owner_id = ? AND c.is_default")
                .param(id).query(String.class).list();
        assertThat(cats).containsExactly("일기장");
    }

    @Test
    void CF_14_1_takenEmailGetsNoMail() throws Exception {
        signup("수연", "su@example.com");
        mail.sent.clear();
        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "signup", "email", "su@example.com",
                "nickname", "다른사람"))).andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN"));
        assertThat(mail.sent).isEmpty();
    }

    @Test
    void CF_01_3_nicknameTakenIgnoringCase() throws Exception {
        signup("Suyeon", "a@example.com");
        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "signup", "email", "b@example.com",
                "nickname", "SUYEON"))).andExpect(jsonPath("$.error.code").value("NICKNAME_TAKEN"));
    }

    @Test
    void CF_01_15_16_17_codeRules() throws Exception {
        String email = "c@example.com";
        var send = Map.<String, Object>of("purpose", "signup", "email", email, "nickname", "코드");
        var first = mvc.perform(postJson("/api/auth/verifications", send)).andExpect(status().isAccepted());
        // 1분에 한 번
        mvc.perform(postJson("/api/auth/verifications", send))
                .andExpect(jsonPath("$.error.code").value("RESEND_TOO_SOON"));
        String code = mail.lastCode(email);
        // 메일 서버가 없는 동안(mode=log)은 화면에 보여 줄 번호를 함께 돌려준다
        first.andExpect(jsonPath("$.devCode").value(code));
        String wrong = code.equals("AAAAAA") ? "BBBBBB" : "AAAAAA";
        for (int i = 0; i < 4; i++) {
            mvc.perform(postJson("/api/auth/verifications/confirm", Map.of("purpose", "signup", "email", email,
                    "code", wrong))).andExpect(jsonPath("$.error.code").value("CODE_MISMATCH"));
        }
        mvc.perform(postJson("/api/auth/verifications/confirm", Map.of("purpose", "signup", "email", email,
                "code", wrong))).andExpect(jsonPath("$.error.code").value("CODE_ATTEMPTS_EXCEEDED"));
        // 5회 틀리면 맞는 번호도 못 쓴다
        mvc.perform(postJson("/api/auth/verifications/confirm", Map.of("purpose", "signup", "email", email,
                "code", code))).andExpect(status().isBadRequest());
        // 하루 5번
        for (int i = 0; i < 4; i++) {
            redis.delete("verify:signup:" + email + ":cooldown");
            mvc.perform(postJson("/api/auth/verifications", send)).andExpect(status().isAccepted());
        }
        redis.delete("verify:signup:" + email + ":cooldown");
        mvc.perform(postJson("/api/auth/verifications", send)).andExpect(jsonPath("$.error.code").value("DAILY_LIMIT"));
    }

    @Test
    void CF_01_15_codeIsSingleUse() throws Exception {
        String email = "d@example.com";
        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "signup", "email", email,
                "nickname", "한번"))).andExpect(status().isAccepted());
        String code = mail.lastCode(email);
        var confirm = Map.of("purpose", "signup", "email", email, "code", code);
        mvc.perform(postJson("/api/auth/verifications/confirm", confirm)).andExpect(status().isOk());
        mvc.perform(postJson("/api/auth/verifications/confirm", confirm))
                .andExpect(jsonPath("$.error.code").value("CODE_EXPIRED"));
    }

    @Test
    void CF_01_18_mailUnavailable() throws Exception {
        mail.available = false;
        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "signup", "email", "e@example.com",
                "nickname", "메일"))).andExpect(jsonPath("$.error.code").value("MAIL_SEND_FAILED"));
    }

    @Test
    void CF_02_3_sameMessageForUnknownEmailAndWrongPassword() throws Exception {
        signup("수연", "su@example.com");
        var a = read(mvc.perform(postJson("/api/auth/login", Map.of("email", "none@example.com", "password", PASSWORD)))
                .andExpect(status().isUnauthorized()).andReturn());
        var b = read(mvc.perform(postJson("/api/auth/login", Map.of("email", "su@example.com", "password", "wrong1!a")))
                .andExpect(status().isUnauthorized()).andReturn());
        assertThat(a).isEqualTo(b);
    }

    @Test
    void CF_02_5_6_7_lockAfterFiveFailures() throws Exception {
        signup("수연", "su@example.com");
        var wrong = Map.of("email", "su@example.com", "password", "wrong1!a");
        for (int i = 0; i < 4; i++) {
            mvc.perform(postJson("/api/auth/login", wrong)).andExpect(jsonPath("$.error.code").value("LOGIN_FAILED"));
        }
        mvc.perform(postJson("/api/auth/login", wrong))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.error.code").value("ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$.error.message").value("로그인 시도가 5회 실패해 잠겼습니다. 10분 뒤에 다시 시도해 주세요"))
                .andExpect(jsonPath("$.error.unlockAt").exists());
        // 잠겨 있으면 맞는 비밀번호도 거절
        mvc.perform(postJson("/api/auth/login", Map.of("email", "su@example.com", "password", PASSWORD)))
                .andExpect(jsonPath("$.error.code").value("ACCOUNT_LOCKED"));
        // 10분이 지나면 풀리고, 성공하면 카운트 0
        jdbc.sql("UPDATE members SET locked_until = now() - interval '1 second'").update();
        login("su@example.com", PASSWORD);
        assertThat(jdbc.sql("SELECT failed_login_count FROM members").query(Integer.class).single()).isZero();
    }

    @Test
    void NF_12_sessionIdChangesOnLogin_CF_02_11_logout() throws Exception {
        signup("수연", "su@example.com");
        MockHttpSession session = new MockHttpSession();
        String before = session.getId();
        mvc.perform(postJson("/api/auth/login", Map.of("email", "su@example.com", "password", PASSWORD))
                .session(session)).andExpect(status().isOk());
        assertThat(session.getId()).isNotEqualTo(before);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(jsonPath("$.member.nickname").value("수연"));
        mvc.perform(post("/api/auth/logout").with(org.springframework.security.test.web.servlet.request
                .SecurityMockMvcRequestPostProcessors.csrf()).session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isNoContent());
    }

    @Test
    void NF_11_postWithoutCsrfRejected() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", "a@b.com", "password", "x")))).andExpect(status().isForbidden());
    }

    @Test
    void CF_25_passwordReset() throws Exception {
        signup("수연", "su@example.com");
        MockHttpSession old = login("su@example.com", PASSWORD);
        // 잠가 둔다
        jdbc.sql("UPDATE members SET locked_until = now() + interval '10 minutes'").update();

        // 가입되지 않은 이메일도 같은 응답, 메일은 안 감 (CF-25-3)
        mail.sent.clear();
        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "reset", "email", "none@example.com")))
                .andExpect(status().isAccepted());
        assertThat(mail.sent).isEmpty();

        // 가입 인증으로는 비밀번호를 못 바꾼다
        String newPw = "new123!@";
        var reset = Map.of("email", "su@example.com", "newPassword", newPw, "newPasswordConfirm", newPw);
        mvc.perform(postJson("/api/auth/password-reset", reset)).andExpect(jsonPath("$.error.code").value("NOT_VERIFIED"));

        verify("reset", "su@example.com", null);
        mvc.perform(postJson("/api/auth/password-reset", reset)).andExpect(status().isOk());
        // 모든 기기 로그아웃 (CF-25-8)
        mvc.perform(get("/api/me").session(old)).andExpect(status().isUnauthorized());
        // 잠금 해제, 새 비밀번호로 로그인 (CF-25-9)
        login("su@example.com", newPw);
        assertThat(mail.sent.stream().anyMatch(s -> s.subject().contains("변경"))).isTrue();
    }
}
