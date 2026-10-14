package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
    @Autowired
    MemberRepository members;

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

    /** 소셜로 가입을 마친다 (제공자 로그인 → 닉네임). 회원 번호를 돌려준다 */
    private long socialSignup(SocialProfile profile, String nickname) throws Exception {
        var session = new MockHttpSession();
        assertThat(complete(profile, session)).isEqualTo(SocialLoginService.SIGNUP_PAGE);
        var r = mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", nickname)).session(session))
                .andExpect(status().isCreated()).andReturn();
        redis.delete(redis.keys("submit:*")); // 연타 방지(5초)를 건너뛴다
        return read(r).get("id").asLong();
    }

    /** 계정은 가입한 방법으로만 로그인한다: 같은 이메일이어도 소셜 계정을 이메일 계정에 연결하지 않는다 */
    @Test
    void emailAccountIsNotLinkedBySocialLogin() throws Exception {
        signup("수연", "su@example.com");

        var session = new MockHttpSession();
        assertThat(complete(kakao("k-1", "  SU@Example.com ", true, "수연"), session))
                .isEqualTo(SocialLoginService.EMAIL_ACCOUNT);
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "k-1")).isEmpty();
        assertThat(session.getAttribute(CONTEXT)).isNull();
        assertThat(session.getAttribute(SocialLoginService.PENDING_ATTRIBUTE)).isNull();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isNoContent());
    }

    @Test
    void emailOfOtherProviderIsNotLinked() throws Exception {
        long id = socialSignup(new SocialProfile(SocialProvider.GOOGLE, "g-1", "both@example.com", true, "구글"), "구글회원");

        var session = new MockHttpSession();
        assertThat(complete(kakao("k-1", "both@example.com", true, "카카오"), session)).isEqualTo("/?social=google-account");
        assertThat(accounts.findMemberId(SocialProvider.KAKAO, "k-1")).isEmpty();
        assertThat(accounts.providersOf(id)).containsExactly(SocialProvider.GOOGLE);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isNoContent());
    }

    /** 소셜로 가입한 이메일: 이메일 가입·로그인·비밀번호 찾기에서 어느 제공자로 로그인하면 되는지 알려 준다 */
    @Test
    void socialAccountEmailPointsToItsProvider() throws Exception {
        socialSignup(kakao("k-1", "only@example.com", true, "카카오"), "카카오회원");
        String message = "카카오로 가입한 이메일입니다. 카카오로 로그인해 주세요";

        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "signup", "email", "only@example.com",
                        "nickname", "새닉")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN"))
                .andExpect(jsonPath("$.error.message").value(message))
                .andExpect(jsonPath("$.error.fields.email").value(message));

        mvc.perform(postJson("/api/auth/login", Map.of("email", "only@example.com", "password", PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("SOCIAL_ACCOUNT"))
                .andExpect(jsonPath("$.error.message").value("카카오로 가입한 계정입니다. 카카오로 로그인해 주세요"));

        // 비밀번호 찾기: 응답은 다른 이메일과 같고, 번호 대신 카카오로 로그인하라는 메일이 간다
        mail.sent.clear();
        mvc.perform(postJson("/api/auth/verifications", Map.of("purpose", "reset", "email", "only@example.com")))
                .andExpect(status().isAccepted());
        assertThat(mail.sent).singleElement().satisfies(m -> {
            assertThat(m.to()).isEqualTo("only@example.com");
            assertThat(m.body()).contains("카카오로 가입한 계정").doesNotContain("인증번호:");
        });
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
        // 비밀번호는 아무도 모르는 값이고, 이메일 로그인은 구글로 로그인하라고 안내한다
        String hash = jdbc.sql("SELECT password_hash FROM members WHERE id = ?").param(id).query(String.class).single();
        assertThat(hash).startsWith("$2");
        mvc.perform(postJson("/api/auth/login", Map.of("email", "new@example.com", "password", PASSWORD)))
                .andExpect(jsonPath("$.error.code").value("SOCIAL_ACCOUNT"))
                .andExpect(jsonPath("$.error.provider").value("google"));

        // 다음 소셜 로그인은 바로 로그인
        var next = new MockHttpSession();
        assertThat(complete(new SocialProfile(SocialProvider.GOOGLE, "g-1", "new@example.com", true, "x"), next))
                .isEqualTo(SocialLoginService.HOME);
        assertThat(memberIdOf(next)).isEqualTo(id);
    }

    /** 소셜로 가입해 비밀번호가 없는 회원: 비밀번호 변경은 막고, 탈퇴는 가입한 소셜 계정으로 다시 확인하고, 복구는 소셜 로그인으로 한다. */
    @Test
    void socialOnlyMemberWithdrawsBySocialReconfirmAndRestoresBySocialLogin() throws Exception {
        var session = new MockHttpSession();
        complete(kakao("k-9", "only@example.com", true, "소셜"), session);
        var r = mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "소셜회원")).session(session))
                .andExpect(status().isCreated()).andReturn();
        long id = read(r).get("id").asLong();

        mvc.perform(get("/api/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.passwordSet").value(false))
                .andExpect(jsonPath("$.socialAccounts[0]").value("kakao"));
        mvc.perform(jsonRequest(put("/api/me/password"), Map.of("currentPassword", "x", "newPassword", PASSWORD,
                "newPasswordConfirm", PASSWORD)).session(session))
                .andExpect(jsonPath("$.error.code").value("PASSWORD_NOT_SET"));

        // 비밀번호 탈퇴는 받지 않는다
        mvc.perform(jsonRequest(delete("/api/me"), Map.of("password", "x", "acknowledged", true)).session(session))
                .andExpect(jsonPath("$.error.code").value("SOCIAL_WITHDRAW_ONLY"));
        // 안내 확인이 먼저
        mvc.perform(postJson("/api/me/withdraw/social", Map.of("acknowledged", false)).session(session))
                .andExpect(jsonPath("$.error.code").value("ACKNOWLEDGE_REQUIRED"));
        mvc.perform(postJson("/api/me/withdraw/social", Map.of("acknowledged", true)).session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.redirectUrl").value("/oauth2/authorization/kakao"));

        // 가입한 카카오 계정으로 다시 확인하면 탈퇴하고 로그아웃한다
        assertThat(complete(kakao("k-9", "only@example.com", true, "소셜"), session))
                .isEqualTo(SocialLoginService.WITHDRAW_DONE);
        assertThat(members.findById(id).orElseThrow().withdrawn()).isTrue();

        // 보관 기간에 소셜 로그인하면 바로 복구하지 않고, 화면에서 복구할지 묻는다
        var again = new MockHttpSession();
        assertThat(complete(kakao("k-9", "only@example.com", true, "소셜"), again))
                .isEqualTo(SocialLoginService.RESTORE_CONFIRM);
        assertThat(again.getAttribute(CONTEXT)).isNull(); // 소셜 토큰을 남기지 않는다
        mvc.perform(get("/api/auth/me").session(again)).andExpect(status().isNoContent());
        assertThat(members.findById(id).orElseThrow().withdrawn()).isTrue();
        mvc.perform(get("/api/auth/social/restore").session(again)).andExpect(status().isOk())
                .andExpect(jsonPath("$.restorableUntil").exists());

        // 복구하겠다고 하면 복구하고 로그인한다
        mvc.perform(postJson("/api/auth/social/restore", Map.of()).session(again)).andExpect(status().isOk())
                .andExpect(jsonPath("$.member.id").value(id));
        assertThat(memberIdOf(again)).isEqualTo(id);
        assertThat(members.findById(id).orElseThrow().withdrawn()).isFalse();
        // 복구 대기 정보는 한 번 쓰면 없다
        mvc.perform(get("/api/auth/social/restore").session(again))
                .andExpect(jsonPath("$.error.code").value("SOCIAL_RESTORE_NOT_FOUND"));

        // 비밀번호 찾기로 정하면 보통 회원과 같아진다
        members.updatePassword(id, "$2a$10$abcdefghijklmnopqrstuuJ1lQ2b7m0W9y7r8eS9K0fG1hI2jK3lO", clock.nowOffset());
        mvc.perform(get("/api/me").session(again)).andExpect(jsonPath("$.passwordSet").value(true));
    }

    /** 탈퇴 확인을 다른 소셜 계정으로 하면 탈퇴하지 않고 원래 회원으로 로그인을 유지한다 */
    @Test
    void withdrawReconfirmWithOtherAccountKeepsMember() throws Exception {
        var session = new MockHttpSession();
        complete(kakao("k-9", "only@example.com", true, "소셜"), session);
        long id = read(mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "소셜회원")).session(session))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
        mvc.perform(postJson("/api/me/withdraw/social", Map.of("acknowledged", true)).session(session))
                .andExpect(status().isOk());

        assertThat(complete(kakao("k-other", "other@example.com", true, "남"), session))
                .isEqualTo(SocialLoginService.WITHDRAW_MISMATCH);
        assertThat(members.findById(id).orElseThrow().withdrawn()).isFalse();
        assertThat(memberIdOf(session)).isEqualTo(id);
        // 확인 정보는 한 번 쓰면 지운다: 다음 소셜 로그인은 보통 로그인이다
        assertThat(SocialLoginService.withdrawIntent(afterOAuth2Login(session))).isEmpty();
    }

    /** 제공자 화면에서 취소하면 탈퇴 확인만 취소하고 로그인은 그대로 둔다 */
    @Test
    void cancelledWithdrawReconfirmKeepsLogin() throws Exception {
        var session = new MockHttpSession();
        complete(kakao("k-9", "only@example.com", true, "소셜"), session);
        long id = read(mvc.perform(postJson("/api/auth/social/signup", Map.of("nickname", "소셜회원")).session(session))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();
        mvc.perform(postJson("/api/me/withdraw/social", Map.of("acknowledged", true)).session(session))
                .andExpect(status().isOk());

        var req = new MockHttpServletRequest();
        req.setSession(session);
        var res = new MockHttpServletResponse();
        handler.onAuthenticationFailure(req, res,
                new org.springframework.security.oauth2.core.OAuth2AuthenticationException("access_denied"));
        assertThat(res.getRedirectedUrl()).isEqualTo(SocialLoginService.WITHDRAW_CANCELLED);
        assertThat(memberIdOf(session)).isEqualTo(id);
        assertThat(members.findById(id).orElseThrow().withdrawn()).isFalse();
    }

    /** 비밀번호가 있는 회원은 소셜 탈퇴를 시작할 수 없다 */
    @Test
    void passwordMemberCannotStartSocialWithdraw() throws Exception {
        var s = member("수연", "su@example.com");
        mvc.perform(postJson("/api/me/withdraw/social", Map.of("acknowledged", true)).session(s))
                .andExpect(jsonPath("$.error.code").value("PASSWORD_WITHDRAW_ONLY"));
    }

    /** 복구하지 않겠다고 하면 탈퇴 상태 그대로, 로그인도 하지 않는다 */
    @Test
    void cancellingSocialRestoreKeepsWithdrawn() throws Exception {
        long id = socialSignup(kakao("k-9", "only@example.com", true, "소셜"), "소셜회원");
        members.markWithdrawn(id, clock.nowOffset());

        var session = new MockHttpSession();
        assertThat(complete(kakao("k-9", "only@example.com", true, "소셜"), session))
                .isEqualTo(SocialLoginService.RESTORE_CONFIRM);
        mvc.perform(jsonRequest(delete("/api/auth/social/restore"), Map.of()).session(session))
                .andExpect(status().isNoContent());
        mvc.perform(postJson("/api/auth/social/restore", Map.of()).session(session))
                .andExpect(jsonPath("$.error.code").value("SOCIAL_RESTORE_NOT_FOUND"));
        assertThat(members.findById(id).orElseThrow().withdrawn()).isTrue();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isNoContent());
    }

    /** 복구 대기 정보가 없는 브라우저에서는 복구할 수 없다 */
    @Test
    void socialRestoreNeedsPendingSession() throws Exception {
        long id = socialSignup(kakao("k-9", "only@example.com", true, "소셜"), "소셜회원");
        members.markWithdrawn(id, clock.nowOffset());
        mvc.perform(postJson("/api/auth/social/restore", Map.of()).session(new MockHttpSession()))
                .andExpect(jsonPath("$.error.code").value("SOCIAL_RESTORE_NOT_FOUND"));
        assertThat(members.findById(id).orElseThrow().withdrawn()).isTrue();
    }

    @Test
    void v23MarksSocialSignupsFromBeforeV22AsPasswordUnset() throws Exception {
        // v1.8.0 소셜 가입: 회원과 연결이 같은 순간에 생겼지만 V22가 password_set = true로 채웠다
        long social = signup("소셜", "social@example.com");
        jdbc.sql("""
                INSERT INTO member_social_accounts (member_id, provider, provider_user_id, email, created_at)
                SELECT id, 'KAKAO', 'k-old', email, created_at FROM members WHERE id = ?""").param(social).update();
        // 이메일로 가입하고 나중에 카카오를 연결한 회원
        long linked = signup("연결", "linked@example.com");
        jdbc.sql("""
                INSERT INTO member_social_accounts (member_id, provider, provider_user_id, email, created_at)
                SELECT id, 'KAKAO', 'k-linked', email, created_at + interval '1 hour' FROM members WHERE id = ?""")
                .param(linked).update();
        long plain = signup("메일", "plain@example.com");

        String v23 = new String(getClass().getResourceAsStream("/db/migration/V23__social_signup_password_unset.sql")
                .readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        jdbc.sql(v23).update();

        assertThat(members.passwordSet(social)).isFalse();
        assertThat(members.passwordSet(linked)).isTrue();
        assertThat(members.passwordSet(plain)).isTrue();
    }

    @Test
    void v24UnlinksSocialAccountsFromEmailMembers() throws Exception {
        long email = signup("메일", "mail@example.com");
        jdbc.sql("""
                INSERT INTO member_social_accounts (member_id, provider, provider_user_id, email, created_at)
                SELECT id, 'KAKAO', 'k-linked', email, created_at + interval '1 hour' FROM members WHERE id = ?""")
                .param(email).update();
        long social = socialSignup(new SocialProfile(SocialProvider.GOOGLE, "g-1", "g@example.com", true, "구글"), "구글회원");

        String v24 = new String(getClass().getResourceAsStream("/db/migration/V24__separate_signup_methods.sql")
                .readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        jdbc.sql(v24).update();

        assertThat(accounts.providersOf(email)).isEmpty();
        assertThat(accounts.providersOf(social)).containsExactly(SocialProvider.GOOGLE);
    }

    @Test
    void emailMemberHasPasswordAndNoSocialAccounts() throws Exception {
        MockHttpSession s = member("수연", "su@example.com");
        mvc.perform(get("/api/me").session(s)).andExpect(status().isOk())
                .andExpect(jsonPath("$.passwordSet").value(true))
                .andExpect(jsonPath("$.socialAccounts").isEmpty());
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
        long id = socialSignup(kakao("12345", "su@example.com", true, "수연"), "수연");
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
