package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.common.KoreanClock;
import com.myblog.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

/**
 * 소셜 로그인: 제공자와는 통신하지 않고, 제공자 로그인이 끝난 뒤의 처리(SocialLoginService)와 가입 마무리 API를 본다.
 * 키를 설정하지 않은 기본 상태에서도 서버가 뜨는 것은 다른 통합 테스트 전체가 확인한다.
 */
class SocialLoginIT extends IntegrationTest {
    private static final String CONTEXT = HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY;

    @Autowired
    SocialLoginService social;
    @Autowired
    SocialLoginHandler handler;
    @Autowired
    SocialAccountRepository accounts;
    @Autowired
    WithdrawalCleaner cleaner;
    @Autowired
    KoreanClock clock;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static SocialProfile kakao(String id, String email, boolean verified, String nickname) {
        return new SocialProfile(SocialProvider.KAKAO, id, email, verified, nickname);
    }

    /** oauth2Login이 끝난 직후처럼 세션에 소셜 토큰이 들어 있는 요청 */
    private static MockHttpServletRequest afterOAuth2Login(MockHttpSession session) {
        var authorities = List.of(new SimpleGrantedAuthority("OAUTH2_USER"));
        var token = new OAuth2AuthenticationToken(new DefaultOAuth2User(authorities, Map.of("id", 1L), "id"),
                authorities, "kakao");
        session.setAttribute(CONTEXT, new SecurityContextImpl(token));
        var req = new MockHttpServletRequest();
        req.setSession(session);
        return req;
    }

    private String complete(SocialProfile profile, MockHttpSession session) {
        return social.complete(profile, afterOAuth2Login(session), new MockHttpServletResponse());
    }

    private long memberIdOf(MockHttpSession session) throws Exception {
        return read(mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andReturn())
                .get("member").get("id").asLong();
    }

    @Test
    void linkedAccountLogsInAsThatMember() throws Exception {
        long id = signup("수연", "su@example.com");
        accounts.insert(id, SocialProvider.KAKAO, "k-1", "other@example.com", clock.nowOffset());

        var session = new MockHttpSession();
        // 연결돼 있으면 제공자 이메일이 없어도 로그인한다
        assertThat(complete(kakao("k-1", null, false, "카카오닉"), session)).isEqualTo(SocialLoginService.HOME);
        assertThat(memberIdOf(session)).isEqualTo(id);
        // 비밀번호 로그인과 같은 인증 정보(회원 번호)로 바뀌어 /api/me도 된다
        mvc.perform(get("/api/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("su@example.com"));
    }

    @Test
    void linkedButWithdrawnMemberIsNotLoggedIn() throws Exception {
        MockHttpSession s = member("수연", "su@example.com");
        long id = memberIdOf(s);
        accounts.insert(id, SocialProvider.KAKAO, "k-1", "su@example.com", clock.nowOffset());
        mvc.perform(jsonRequest(delete("/api/me"),
                Map.of("password", PASSWORD, "acknowledged", true)).session(s)).andExpect(status().is2xxSuccessful());

        var session = new MockHttpSession();
        assertThat(complete(kakao("k-1", "su@example.com", true, "수연"), session))
                .isEqualTo(SocialLoginService.WITHDRAWN);
        assertThat(session.getAttribute(CONTEXT)).isNull(); // 소셜 토큰도 남기지 않는다
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isNoContent());
    }

    @Test
    void verifiedEmailOfActiveMemberIsLinkedAndLoggedIn() throws Exception {
        long id = signup("수연", "su@example.com");

        var session = new MockHttpSession();
        assertThat(complete(kakao("k-1", "  SU@Example.com ", true, "수연"), session))
                .isEqualTo(SocialLoginService.HOME);
        assertThat(memberIdOf(session)).isEqualTo(id);
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "k-1")).contains(id);

        // 다음부터는 연결로 찾는다 (이메일이 바뀌어도)
        var again = new MockHttpSession();
        assertThat(complete(kakao("k-1", "changed@example.com", true, "수연"), again)).isEqualTo(SocialLoginService.HOME);
        assertThat(memberIdOf(again)).isEqualTo(id);
    }

    @Test
    void emailOfWithdrawnMemberIsNotLinked() throws Exception {
        MockHttpSession s = member("수연", "su@example.com");
        mvc.perform(jsonRequest(delete("/api/me"),
                Map.of("password", PASSWORD, "acknowledged", true)).session(s)).andExpect(status().is2xxSuccessful());

        var session = new MockHttpSession();
        assertThat(complete(kakao("k-1", "su@example.com", true, "수연"), session))
                .isEqualTo(SocialLoginService.WITHDRAWN);
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "k-1")).isEmpty();
        assertThat(session.getAttribute(SocialLoginService.PENDING_ATTRIBUTE)).isNull();
    }

    @Test
    void missingOrUnverifiedEmailIsRefused() throws Exception {
        signup("수연", "su@example.com");

        var noEmail = new MockHttpSession();
        assertThat(complete(kakao("k-1", null, true, "닉"), noEmail)).isEqualTo(SocialLoginService.NO_EMAIL);
        assertThat(noEmail.getAttribute(CONTEXT)).isNull();
        assertThat(noEmail.getAttribute(SocialLoginService.PENDING_ATTRIBUTE)).isNull();

        // 인증되지 않은 이메일로는 남의 계정에 연결하지 않는다
        var unverified = new MockHttpSession();
        assertThat(complete(kakao("k-2", "su@example.com", false, "닉"), unverified))
                .isEqualTo(SocialLoginService.NO_EMAIL);
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "k-2")).isEmpty();
        mvc.perform(get("/api/auth/me").session(unverified)).andExpect(status().isNoContent());
    }

    @Test
    void newEmailGoesToSignupAndFinishesWithLogin() throws Exception {
        var session = new MockHttpSession();
        assertThat(complete(new SocialProfile(SocialProvider.GOOGLE, "g-1", "New@Example.com", true, "Jane Q. Doe-Smith!"),
                session)).isEqualTo(SocialLoginService.SIGNUP_PAGE);
        assertThat(session.getAttribute(CONTEXT)).isNull(); // 가입 전에는 로그인 상태가 아니다
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isNoContent());

        mvc.perform(get("/api/auth/social/pending").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("google"))
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.nickname").value("JaneQDoeSm")); // 쓸 수 없는 글자를 빼고 10자 안으로

        var r = mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "새회원")).session(session))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.member.nickname").value("새회원"))
                .andExpect(jsonPath("$.member.email").value("new@example.com"))
                .andReturn();
        long id = read(r).get("id").asLong();

        // 로그인돼 있고, 블로그와 기본 다이어리도 이메일 가입처럼 생긴다
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.member.id").value(id))
                .andExpect(jsonPath("$.blog.name").value("새회원의 블로그"));
        assertThat(defaultCategory(blogIdOf(session))).isPositive();
        assertThat(accounts.findMemberId(SocialProvider.GOOGLE, "g-1")).contains(id);

        // 가입 정보는 한 번만 쓴다
        mvc.perform(get("/api/auth/social/pending").session(session)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("SOCIAL_SIGNUP_NOT_FOUND"));
        // 비밀번호는 아무도 모르는 값이라 비밀번호 찾기로 정하기 전에는 이메일 로그인이 안 된다
        String hash = jdbc.sql("SELECT password_hash FROM members WHERE id = ?").param(id).query(String.class).single();
        assertThat(hash).startsWith("$2");
        mvc.perform(postJson("/api/auth/login", Map.of("email", "new@example.com", "password", PASSWORD)))
                .andExpect(jsonPath("$.error.code").value("LOGIN_FAILED"));

        // 다음 소셜 로그인은 바로 로그인
        var next = new MockHttpSession();
        assertThat(complete(new SocialProfile(SocialProvider.GOOGLE, "g-1", "new@example.com", true, "x"), next))
                .isEqualTo(SocialLoginService.HOME);
        assertThat(memberIdOf(next)).isEqualTo(id);
    }

    @Test
    void socialSignupUsesNicknameRules() throws Exception {
        signup("수연", "su@example.com");
        var session = new MockHttpSession();
        complete(kakao("k-1", "new@example.com", true, "수연"), session);
        mvc.perform(get("/api/auth/social/pending").session(session)).andExpect(jsonPath("$.nickname").value("수연"));

        mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "JANE!")).session(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.nickname").exists());
        redis.delete(redis.keys("submit:*")); // 연타 방지(5초)를 건너뛴다
        mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "수연")).session(session))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("NICKNAME_TAKEN"));
        // 실패해도 가입 정보는 남아 다시 시도할 수 있다
        mvc.perform(get("/api/auth/social/pending").session(session)).andExpect(status().isOk());
        assertThat(jdbc.sql("SELECT count(*) FROM members").query(Long.class).single()).isEqualTo(1);
    }

    @Test
    void withoutPendingSignupEndpointsAnswerNotFound() throws Exception {
        mvc.perform(get("/api/auth/social/pending")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("SOCIAL_SIGNUP_NOT_FOUND"));
        mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "새회원")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("SOCIAL_SIGNUP_NOT_FOUND"));
    }

    @Test
    void successHandlerReadsKakaoAttributesAndRedirects() throws Exception {
        long id = signup("수연", "su@example.com");
        Map<String, Object> attributes = Map.of(
                "id", 12345L,
                "kakao_account", Map.of("email", "su@example.com", "is_email_verified", true,
                        "profile", Map.of("nickname", "수연")));
        var authorities = List.of(new SimpleGrantedAuthority("OAUTH2_USER"));
        var token = new OAuth2AuthenticationToken(new DefaultOAuth2User(authorities, attributes, "id"),
                authorities, "kakao");
        var session = new MockHttpSession();
        var req = new MockHttpServletRequest();
        req.setSession(session);
        var res = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(req, res, token);

        assertThat(res.getRedirectedUrl()).isEqualTo("/");
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "12345")).contains(id);
        assertThat(memberIdOf(session)).isEqualTo(id);
    }

    @Test
    void failureHandlerRedirectsHomeWithNotice() throws Exception {
        var req = new MockHttpServletRequest();
        var res = new MockHttpServletResponse();
        handler.onAuthenticationFailure(req, res,
                new org.springframework.security.oauth2.core.OAuth2AuthenticationException("access_denied"));
        assertThat(res.getRedirectedUrl()).isEqualTo("/?social=failed");
    }

    @Test
    void anonymizingWithdrawnMemberRemovesSocialLinks() throws Exception {
        MockHttpSession s = member("수연", "su@example.com");
        long id = memberIdOf(s);
        accounts.insert(id, SocialProvider.KAKAO, "k-1", "su@example.com", clock.nowOffset());
        mvc.perform(jsonRequest(delete("/api/me"),
                Map.of("password", PASSWORD, "acknowledged", true)).session(s)).andExpect(status().is2xxSuccessful());
        jdbc.sql("UPDATE members SET deleted_at = deleted_at - interval '31 days' WHERE id = ?").param(id).update();

        assertThat(cleaner.cleanUp()).isEqualTo(1);
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "k-1")).isEmpty();
        // 같은 카카오 계정으로 새로 가입할 수 있다
        var session = new MockHttpSession();
        assertThat(complete(kakao("k-1", "su@example.com", true, "수연"), session))
                .isEqualTo(SocialLoginService.SIGNUP_PAGE);
    }

    @Test
    void configListsNoProvidersWithoutKeys() throws Exception {
        mvc.perform(get("/api/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.socialLogin").isArray())
                .andExpect(jsonPath("$.socialLogin").isEmpty());
    }
}
