package com.myblog.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.myblog.common.MyBlogProperties;
import com.myblog.common.error.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class RulesTest {
    static MyBlogProperties props() {
        var member = new MyBlogProperties.Member(2, 10, 8, 10, "!@#$%^&*()_+-=", 100, java.time.Duration.ofDays(30));
        return new MyBlogProperties(member, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null);
    }

    private final PasswordPolicy passwords = new PasswordPolicy(props());
    private final NicknamePolicy nicknames = new NicknamePolicy(props());

    @ParameterizedTest
    @ValueSource(strings = {"abc123!@", "Abcdef12#", "a1!a1!a1!a"})
    void CF_01_4_validPasswords(String pw) {
        assertThat(passwords.isValid(pw)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ab12!@x", "abc123!@xyz", "abcdefg!", "12345678!", "abcd1234", "abc 123!@", "abc123!?",
            "가나다123!@"})
    void CF_01_4_invalidPasswords(String pw) {
        assertThat(passwords.isValid(pw)).isFalse();
    }

    @Test
    void CF_01_3_nicknameRules() {
        assertThat(nicknames.validate(" 수연 ")).isEqualTo("수연");
        assertThat(nicknames.validate("Suyeon99")).isEqualTo("Suyeon99");
        for (String bad : new String[] {"수", "열한글자닉네임입니다요", "su yeon", "수연!", ""}) {
            assertThatThrownBy(() -> nicknames.validate(bad)).isInstanceOf(ApiException.class);
        }
        assertThat(NicknamePolicy.key("SuYeon")).isEqualTo("suyeon");
    }

    @Test
    void CF_01_2_emailNormalized() {
        assertThat(EmailNormalizer.normalize("  Su@Example.COM ")).isEqualTo("su@example.com");
        assertThatThrownBy(() -> EmailNormalizer.normalize("not-an-email")).isInstanceOf(ApiException.class);
    }

    @Test
    void CF_01_12_codeFormat() {
        var gen = new VerificationCodeGenerator();
        for (int i = 0; i < 500; i++) {
            String code = gen.generate();
            assertThat(code).hasSize(6).matches("[A-Z2-9]{6}").doesNotContain("O", "0", "I", "1");
        }
    }
}
