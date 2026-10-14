package com.myblog.mail;

import com.myblog.common.MyBlogProperties;
import org.springframework.stereotype.Component;

/** CF-01-12, CF-25-4, CF-15-16의 메일 내용. */
@Component
public class MailTemplates {
    public record Mail(String subject, String body) {}

    private final String service;
    private final long minutes;

    public MailTemplates(MyBlogProperties props) {
        this.service = props.mail().serviceName();
        this.minutes = props.verification().codeTtl().toMinutes();
    }

    public Mail signupCode(String code) {
        return new Mail("[" + service + "] 회원가입 인증번호", """
                %s 회원가입 인증번호입니다.

                인증번호: %s
                유효 시간: %d분

                본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                """.formatted(service, code, minutes));
    }

    public Mail resetCode(String code) {
        return new Mail("[" + service + "] 비밀번호 찾기 인증번호", """
                %s 비밀번호 찾기 인증번호입니다.

                인증번호: %s
                유효 시간: %d분

                본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                """.formatted(service, code, minutes));
    }

    /** 소셜로 가입해 비밀번호가 없는 계정으로 비밀번호 찾기를 했을 때. provider는 카카오·구글 */
    public Mail socialAccountNoPassword(String provider) {
        return new Mail("[" + service + "] 비밀번호 찾기 안내", """
                이 이메일은 %s %s로 가입한 계정이라 비밀번호가 없습니다.
                로그인 창에서 "%s로 시작하기"를 눌러 로그인해 주세요.

                본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                """.formatted(service, provider, provider));
    }

    public Mail passwordChanged() {
        return new Mail("[" + service + "] 비밀번호가 변경되었습니다", """
                %s 계정의 비밀번호가 변경되었습니다.

                본인이 변경하지 않았다면 비밀번호 찾기로 비밀번호를 다시 정해 주세요.
                """.formatted(service));
    }
}
