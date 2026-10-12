package com.myblog.member;

import com.myblog.common.MyBlogProperties;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.Messages;
import org.springframework.stereotype.Component;

/** CF-01-4: 영문·숫자·허용 특수문자를 각각 1개 이상, 8~64자, 공백 불가. */
@Component
public class PasswordPolicy {
    private final MyBlogProperties.Member rules;

    public PasswordPolicy(MyBlogProperties props) {
        this.rules = props.member();
    }

    public boolean isValid(String pw) {
        if (pw == null || pw.length() < rules.passwordMin() || pw.length() > rules.passwordMax()) {
            return false;
        }
        boolean letter = false;
        boolean digit = false;
        boolean special = false;
        for (char c : pw.toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                letter = true;
            } else if (c >= '0' && c <= '9') {
                digit = true;
            } else if (rules.passwordSpecials().indexOf(c) >= 0) {
                special = true;
            } else {
                return false; // 공백, 한글, 허용하지 않은 특수문자
            }
        }
        return letter && digit && special;
    }

    /** 새 비밀번호와 확인을 함께 검사한다 (CF-01-4, CF-01-5). */
    public void validate(String field, String password, String confirmField, String confirm) {
        if (!isValid(password)) {
            throw ApiException.field(field, Messages.PASSWORD_RULE);
        }
        if (!password.equals(confirm)) {
            throw ApiException.field(confirmField, Messages.PASSWORD_CONFIRM_MISMATCH);
        }
    }
}
