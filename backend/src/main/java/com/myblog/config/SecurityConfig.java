package com.myblog.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.GlobalExceptionHandler;
import com.myblog.member.SocialLoginHandler;
import com.myblog.member.SocialLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.session.DefaultCookieSerializerCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.RegisterSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.session.HttpSessionEventPublisher;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.security.SpringSessionBackedSessionRegistry;

/**
 * 세션 쿠키 로그인 + CSRF 쿠키 토큰 (research §2, NF-10~12).
 * 세션은 Redis에 둔다(Spring Session). 서버를 새로 띄워도 로그인이 유지돼 무중단 배포가 된다.
 * 회원별 세션 목록은 SessionRegistry가 관리해 비밀번호 변경·탈퇴 때 다른 기기의 로그인을 끊는다 (CF-15-15, CF-25-8).
 * 소셜 로그인(카카오·구글)은 키가 설정된 제공자가 있을 때만 켠다. 로그인하면 비밀번호 로그인과 같은 세션이 된다.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, SessionRegistry sessionRegistry, ObjectMapper mapper,
                                    SocialClientRegistrations socialClients, SocialLoginHandler socialHandler)
            throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null); // 토큰을 매 요청 쿠키로 내려 준다(SPA)
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler))
                .securityContext(sc -> sc.securityContextRepository(securityContextRepository()))
                .sessionManagement(s -> s
                        .sessionFixation(f -> f.changeSessionId())
                        .maximumSessions(-1)
                        .sessionRegistry(sessionRegistry)
                        .expiredSessionStrategy(event -> writeError(event.getResponse(), mapper)))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/me/**", "/api/manage/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/posts/*/edit").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                        .requestMatchers("/api/auth/verifications/**", "/api/auth/verifications",
                                "/api/auth/signup", "/api/auth/login", "/api/auth/restore", "/api/auth/password-reset",
                                "/api/auth/social/signup").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e.authenticationEntryPoint(
                        (req, res, ex) -> writeError(res, mapper)))
                .formLogin(f -> f.disable())
                .httpBasic(b -> b.disable())
                .logout(l -> l.disable());
        if (!socialClients.isEmpty()) {
            // 소셜 로그인: /oauth2/authorization/{kakao|google} → 제공자 → /login/oauth2/code/{kakao|google}
            http.oauth2Login(o -> o
                    .clientRegistrationRepository(socialClients)
                    .authorizedClientRepository(new DiscardingAuthorizedClientRepository())
                    .loginPage("/") // 기본 로그인 화면(/login)을 만들지 않는다
                    .authorizationEndpoint(a -> a.authorizationRequestResolver(
                            new ReconfirmingAuthorizationRequestResolver(socialClients)))
                    .successHandler(socialHandler)
                    .failureHandler(socialHandler));
        }
        return http.build();
    }

    /**
     * 탈퇴 확인 중이면 제공자에게 다시 로그인하게 해 달라고 요청한다. 이미 로그인돼 있어도 그냥 통과되지 않게 한다.
     * 카카오는 prompt=login(다시 로그인), 구글은 prompt=select_account(계정을 다시 고르게)를 쓴다.
     */
    static class ReconfirmingAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {
        private final DefaultOAuth2AuthorizationRequestResolver delegate;

        ReconfirmingAuthorizationRequestResolver(SocialClientRegistrations clients) {
            this.delegate = new DefaultOAuth2AuthorizationRequestResolver(clients,
                    OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI);
        }

        @Override
        public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
            return reconfirm(request, delegate.resolve(request));
        }

        @Override
        public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
            return reconfirm(request, delegate.resolve(request, clientRegistrationId));
        }

        private static OAuth2AuthorizationRequest reconfirm(HttpServletRequest request, OAuth2AuthorizationRequest auth) {
            if (auth == null || SocialLoginService.withdrawIntent(request).isEmpty()) {
                return auth;
            }
            String registrationId = auth.getAttribute(OAuth2ParameterNames.REGISTRATION_ID);
            String prompt = SocialClientRegistrations.KAKAO.equals(registrationId) ? "login" : "select_account";
            return OAuth2AuthorizationRequest.from(auth)
                    .additionalParameters(p -> p.put("prompt", prompt))
                    .build();
        }
    }

    /**
     * 제공자의 액세스 토큰은 로그인 때 회원 정보를 받는 데만 쓰고 보관하지 않는다.
     * 기본 저장소는 서버 메모리에 로그인마다 토큰을 쌓는다.
     */
    static class DiscardingAuthorizedClientRepository implements OAuth2AuthorizedClientRepository {
        @Override
        public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(String registrationId, Authentication principal,
                                                                         HttpServletRequest request) {
            return null;
        }

        @Override
        public void saveAuthorizedClient(OAuth2AuthorizedClient client, Authentication principal,
                                         HttpServletRequest request, HttpServletResponse response) {
        }

        @Override
        public void removeAuthorizedClient(String registrationId, Authentication principal,
                                           HttpServletRequest request, HttpServletResponse response) {
        }
    }

    private static void writeError(HttpServletResponse res, ObjectMapper mapper) throws IOException {
        res.setStatus(401);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        mapper.writeValue(res.getWriter(), GlobalExceptionHandler.errorBody(ErrorCode.UNAUTHENTICATED,
                ErrorCode.UNAUTHENTICATED.message(), Map.of(), Map.of()));
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** Redis 세션이면 Redis의 회원별 목록을 쓰고, Redis 세션을 끈 테스트에서는 메모리 목록을 쓴다. */
    @Bean
    SessionRegistry sessionRegistry(ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> sessions) {
        var repository = sessions.getIfAvailable();
        return repository != null ? new SpringSessionBackedSessionRegistry<>(repository) : new SessionRegistryImpl();
    }

    /**
     * 세션 쿠키 값을 세션 번호 그대로 쓴다. Spring Session은 기본으로 base64로 바꿔 담는데,
     * SessionCookieRefreshFilter가 쓸 때마다 다시 내려 주는 쿠키는 번호 그대로라 둘이 어긋나면 로그인이 풀린다.
     */
    @Bean
    DefaultCookieSerializerCustomizer plainSessionCookie() {
        return serializer -> serializer.setUseBase64Encoding(false);
    }

    @Bean
    SessionAuthenticationStrategy loginSessionStrategy(SessionRegistry sessionRegistry) {
        return new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(),
                new RegisterSessionAuthenticationStrategy(sessionRegistry)));
    }

    @Bean
    HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
