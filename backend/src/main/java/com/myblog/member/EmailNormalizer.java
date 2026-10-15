package com.myblog.member;

import com.myblog.common.error.ApiException;
import com.myblog.common.error.Messages;
import java.util.Locale;
import java.util.regex.Pattern;

/** CF-01-2: 앞뒤 공백 제거, 대소문자 무시. 검사식은 소유 수량자(++)라 되돌아가지 않아 긴 입력에도 바로 끝난다. */
public final class EmailNormalizer {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]++@[^\\s@.]++(?:\\.[^\\s@.]++)++$");

    private EmailNormalizer() {}

    public static String normalize(String raw) {
        String email = raw == null ? "" : raw.strip().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) {
            throw ApiException.field("email", Messages.EMAIL_INVALID);
        }
        return email;
    }
}
