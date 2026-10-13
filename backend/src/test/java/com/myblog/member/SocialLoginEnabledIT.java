package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** 카카오 키만 설정하면 카카오만 켜지고, 돌아올 주소는 SITE_URL(myblog.oauth.redirect-base)을 따른다. 제공자와는 통신하지 않는다. */
@TestPropertySource(properties = {
        "myblog.oauth.kakao.client-id=test-kakao-client",
        "myblog.oauth.kakao.client-secret=test-kakao-secret",
        "myblog.oauth.redirect-base=https://blog.example.com/"})
class SocialLoginEnabledIT extends IntegrationTest {

    @Test
    void configListsOnlyConfiguredProviders() throws Exception {
        mvc.perform(get("/api/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.socialLogin.length()").value(1))
                .andExpect(jsonPath("$.socialLogin[0]").value("kakao"));
    }

    @Test
    void kakaoAuthorizationRedirectsToKakaoWithSiteRedirectUri() throws Exception {
        var res = mvc.perform(get("/oauth2/authorization/kakao")).andExpect(status().is3xxRedirection())
                .andReturn().getResponse();
        String location = res.getRedirectedUrl();
        assertThat(location).startsWith("https://kauth.kakao.com/oauth/authorize?")
                .contains("client_id=test-kakao-client")
                .contains("redirect_uri=https://blog.example.com/login/oauth2/code/kakao")
                .contains("scope=profile_nickname%20account_email");
    }

    @Test
    void apiStillAnswers401InsteadOfRedirectingToLogin() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
    }

    @Test
    void unconfiguredProviderIsNotAvailable() throws Exception {
        var res = mvc.perform(get("/oauth2/authorization/google")).andReturn().getResponse();
        assertThat(res.getRedirectedUrl() == null || !res.getRedirectedUrl().contains("accounts.google.com")).isTrue();
    }

    @Test
    void cancelledLoginRedirectsHomeWithNotice() throws Exception {
        // 동의 화면에서 취소하면 제공자가 error와 함께 돌려보낸다
        mvc.perform(get("/login/oauth2/code/kakao").param("error", "access_denied").param("state", "x"))
                .andExpect(status().is3xxRedirection())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .redirectedUrl("/?social=failed"));
    }
}
