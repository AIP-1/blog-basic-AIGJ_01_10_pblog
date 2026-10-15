package com.myblog.member;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/** oauth2Login이 끝나면 불린다. 성공이면 {@link SocialLoginService}가 갈 곳을 정하고, 실패면 홈에서 안내한다. */
@Component
public class SocialLoginHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {
    private static final Logger log = LoggerFactory.getLogger(SocialLoginHandler.class);

    private final SocialLoginService social;
    private final RedirectStrategy redirect = new DefaultRedirectStrategy();

    public SocialLoginHandler(SocialLoginService social) {
        this.social = social;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest req, HttpServletResponse res, Authentication auth)
            throws IOException {
        String target;
        try {
            var token = (OAuth2AuthenticationToken) auth;
            var profile = SocialProfile.from(token.getAuthorizedClientRegistrationId(), token.getPrincipal().getAttributes());
            target = social.complete(profile, req, res);
        } catch (RuntimeException e) {
            log.warn("Social login could not be completed", e);
            social.forgetAuthentication(req, res);
            target = SocialLoginService.FAILED;
        }
        redirect.sendRedirect(req, res, target);
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest req, HttpServletResponse res, AuthenticationException e)
            throws IOException {
        // 사용자가 동의를 취소한 경우도 여기로 온다
        log.info("Social login failed: {}", e.getMessage());
        redirect.sendRedirect(req, res, social.failureRedirect(req, res));
    }
}
