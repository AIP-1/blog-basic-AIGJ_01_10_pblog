package com.myblog.member;

import java.util.Map;

/**
 * 제공자가 알려 준 회원 정보 중 가입·로그인에 쓰는 것만 모은다.
 * email은 제공자가 인증했다고 한 경우(emailVerified)만 믿는다.
 */
public record SocialProfile(SocialProvider provider, String providerUserId, String email, boolean emailVerified,
                            String nickname) {

    /** OAuth2 로그인 결과의 attributes에서 꺼낸다. */
    public static SocialProfile from(String registrationId, Map<String, Object> attributes) {
        SocialProvider provider = SocialProvider.fromRegistrationId(registrationId);
        return switch (provider) {
            case KAKAO -> kakao(attributes);
            case GOOGLE -> google(attributes);
        };
    }

    /** 카카오: id, kakao_account.email · is_email_verified, kakao_account.profile.nickname (없으면 properties.nickname) */
    private static SocialProfile kakao(Map<String, Object> a) {
        Map<?, ?> account = map(a.get("kakao_account"));
        String nickname = text(map(account.get("profile")).get("nickname"));
        if (nickname == null) {
            nickname = text(map(a.get("properties")).get("nickname"));
        }
        return new SocialProfile(SocialProvider.KAKAO, text(a.get("id")), text(account.get("email")),
                bool(account.get("is_email_verified")), nickname);
    }

    /** 구글(OpenID Connect): sub, email · email_verified, name */
    private static SocialProfile google(Map<String, Object> a) {
        return new SocialProfile(SocialProvider.GOOGLE, text(a.get("sub")), text(a.get("email")),
                bool(a.get("email_verified")), text(a.get("name")));
    }

    private static Map<?, ?> map(Object o) {
        return o instanceof Map<?, ?> m ? m : Map.of();
    }

    private static String text(Object o) {
        if (o == null) {
            return null;
        }
        String s = o.toString().strip();
        return s.isEmpty() ? null : s;
    }

    private static boolean bool(Object o) {
        return o instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(o));
    }
}
