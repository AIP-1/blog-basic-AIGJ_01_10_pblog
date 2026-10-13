package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** 제공자 응답(attributes)에서 회원 정보를 꺼낸다. */
class SocialProfileTest {

    @Test
    void kakaoUsesAccountEmailAndFallsBackToPropertiesNickname() {
        var p = SocialProfile.from("kakao", Map.of(
                "id", 42L,
                "properties", Map.of("nickname", "옛닉"),
                "kakao_account", Map.of("email", "a@example.com", "is_email_verified", false)));
        assertThat(p).isEqualTo(new SocialProfile(SocialProvider.KAKAO, "42", "a@example.com", false, "옛닉"));
    }

    @Test
    void kakaoWithoutEmailConsent() {
        var p = SocialProfile.from("kakao", Map.of("id", 7L,
                "kakao_account", Map.of("profile", Map.of("nickname", "닉"))));
        assertThat(p.email()).isNull();
        assertThat(p.emailVerified()).isFalse();
        assertThat(p.nickname()).isEqualTo("닉");
    }

    @Test
    void googleUsesOidcClaims() {
        var p = SocialProfile.from("google", Map.of("sub", "1098", "email", "b@example.com",
                "email_verified", true, "name", "Bee"));
        assertThat(p).isEqualTo(new SocialProfile(SocialProvider.GOOGLE, "1098", "b@example.com", true, "Bee"));
    }
}
