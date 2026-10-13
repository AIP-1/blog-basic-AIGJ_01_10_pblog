package com.myblog.config;

import com.myblog.common.MyBlogProperties;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.stereotype.Component;

/**
 * 소셜 로그인 제공자 목록. myblog.oauth.*.client-id가 있는 제공자만 담는다.
 * spring.security.oauth2.client.registration 설정을 쓰지 않는 이유: 값이 비어 있으면 서버가 뜨지 않는다.
 * 키가 하나도 없으면 빈 목록이고, SecurityConfig가 oauth2Login을 켜지 않아 지금처럼 동작한다.
 */
@Component
public class SocialClientRegistrations implements ClientRegistrationRepository, Iterable<ClientRegistration> {
    public static final String KAKAO = "kakao";
    public static final String GOOGLE = "google";

    private final Map<String, ClientRegistration> registrations = new LinkedHashMap<>();

    public SocialClientRegistrations(MyBlogProperties props) {
        MyBlogProperties.Oauth oauth = props.oauth();
        if (oauth == null) {
            return;
        }
        String redirectUri = redirectBase(oauth.redirectBase()) + "/login/oauth2/code/{registrationId}";
        if (oauth.kakao() != null && oauth.kakao().enabled()) {
            registrations.put(KAKAO, kakao(oauth.kakao(), redirectUri));
        }
        if (oauth.google() != null && oauth.google().enabled()) {
            registrations.put(GOOGLE, CommonOAuth2Provider.GOOGLE.getBuilder(GOOGLE)
                    .clientId(oauth.google().clientId().strip())
                    .clientSecret(secret(oauth.google()))
                    .scope("openid", "profile", "email")
                    .redirectUri(redirectUri)
                    .build());
        }
    }

    private static ClientRegistration kakao(MyBlogProperties.Oauth.Provider p, String redirectUri) {
        return ClientRegistration.withRegistrationId(KAKAO)
                .clientId(p.clientId().strip())
                .clientSecret(secret(p))
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(redirectUri)
                .scope("profile_nickname", "account_email")
                .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                .tokenUri("https://kauth.kakao.com/oauth/token")
                .userInfoUri("https://kapi.kakao.com/v2/user/me")
                .userNameAttributeName("id")
                .clientName("카카오")
                .build();
    }

    private static String secret(MyBlogProperties.Oauth.Provider p) {
        return p.clientSecret() == null ? "" : p.clientSecret().strip();
    }

    /** 비어 있으면 요청 주소({baseUrl})를 쓰고, 끝의 / 는 뗀다. */
    private static String redirectBase(String raw) {
        String base = raw == null || raw.isBlank() ? "{baseUrl}" : raw.strip();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base;
    }

    @Override
    public ClientRegistration findByRegistrationId(String registrationId) {
        return registrationId == null ? null : registrations.get(registrationId);
    }

    @Override
    public Iterator<ClientRegistration> iterator() {
        return registrations.values().iterator();
    }

    /** 켜진 제공자 이름 (kakao, google 순). 화면 설정(/api/config)에 내려 준다. */
    public List<String> enabledIds() {
        return List.copyOf(registrations.keySet());
    }

    public boolean isEmpty() {
        return registrations.isEmpty();
    }
}
