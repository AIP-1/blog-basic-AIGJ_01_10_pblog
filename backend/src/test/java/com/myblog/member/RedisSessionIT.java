package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** 로그인 세션이 Redis에 저장되고, 서버 메모리가 아니라 쿠키 + Redis만으로 로그인이 이어지는지 본다 (무중단 배포). */
@TestPropertySource(properties = "spring.autoconfigure.exclude=")
class RedisSessionIT extends IntegrationTest {

    private Cookie loginCookie(String email) throws Exception {
        var r = mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", PASSWORD)))
                .andExpect(status().isOk()).andReturn();
        Cookie c = r.getResponse().getCookie("MYBLOG_SESSION");
        assertThat(c).isNotNull();
        return c;
    }

    @Test
    void loginLivesInRedisAndSurvivesWithOnlyTheCookie() throws Exception {
        signup("수연", "su@example.com");
        Cookie c = loginCookie("su@example.com");

        assertThat(redis.keys("myblog:session:sessions:*")).isNotEmpty();
        // 새 요청에는 서버 쪽 세션 객체 없이 쿠키만 보낸다: 다른 서버(새로 배포된 서버)가 받은 것과 같다
        mvc.perform(get("/api/me").cookie(c)).andExpect(status().isOk());
    }

    @Test
    void passwordChangeLogsOutOtherDevicesThroughRedis() throws Exception {
        signup("수연", "su@example.com");
        Cookie phone = loginCookie("su@example.com");
        Cookie laptop = loginCookie("su@example.com");
        String newPw = "new123!@";
        mvc.perform(jsonRequest(put("/api/me/password"), Map.of("currentPassword", PASSWORD, "newPassword", newPw,
                "newPasswordConfirm", newPw)).cookie(laptop)).andExpect(status().isOk());

        mvc.perform(get("/api/me").cookie(laptop)).andExpect(status().isOk());
        mvc.perform(get("/api/me").cookie(phone)).andExpect(status().isUnauthorized());
    }
}
