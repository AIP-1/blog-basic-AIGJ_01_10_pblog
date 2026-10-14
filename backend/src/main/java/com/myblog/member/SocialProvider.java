package com.myblog.member;

import java.util.Locale;

/** 소셜 로그인 제공자. DB(member_social_accounts.provider)에는 이름 그대로(KAKAO), 주소와 화면에는 소문자(kakao)로 쓴다. */
public enum SocialProvider {
    KAKAO("카카오"),
    GOOGLE("구글");

    private final String displayName;

    SocialProvider(String displayName) {
        this.displayName = displayName;
    }

    /** 화면 문구에 쓰는 이름 (카카오, 구글) */
    public String displayName() {
        return displayName;
    }

    public String registrationId() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static SocialProvider fromRegistrationId(String registrationId) {
        return valueOf(registrationId.toUpperCase(Locale.ROOT));
    }
}
