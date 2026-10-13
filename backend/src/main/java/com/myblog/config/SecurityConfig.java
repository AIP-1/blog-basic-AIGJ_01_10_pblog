package com.myblog.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.session.SessionRegistryImpl;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
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
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, SessionRegistry sessionRegistry, ObjectMapper mapper)
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
                                "/api/auth/signup", "/api/auth/login", "/api/auth/restore", "/api/auth/password-reset").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e.authenticationEntryPoint(
                        (req, res, ex) -> writeError(res, mapper)))
                .formLogin(f -> f.disable())
                .httpBasic(b -> b.disable())
                .logout(l -> l.disable());
        return http.build();
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
