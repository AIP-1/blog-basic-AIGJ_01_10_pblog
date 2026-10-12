package com.myblog.member;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.RedisGuard;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.mail.MailSender;
import com.myblog.mail.MailTemplates;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * 이메일 인증번호 (CF-01-11~21, CF-25-2~5). 키 설계는 research §3.
 * 용도(signup/reset)를 키에 넣어 가입 인증으로 비밀번호를 바꾸지 못하게 한다.
 */
@Service
public class EmailVerificationService {
    public enum Purpose {
        SIGNUP, RESET;

        String key() {
            return name().toLowerCase();
        }

        public static Purpose parse(String s) {
            if ("signup".equals(s)) {
                return SIGNUP;
            }
            if ("reset".equals(s)) {
                return RESET;
            }
            throw ApiException.field("purpose", "용도가 올바르지 않습니다");
        }
    }

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final StringRedisTemplate redis;
    private final RedisGuard guard;
    private final MyBlogProperties.Verification rules;
    private final VerificationCodeGenerator generator;
    private final MailSender mail;
    private final MailTemplates templates;
    private final KoreanClock clock;

    public EmailVerificationService(StringRedisTemplate redis, RedisGuard guard, MyBlogProperties props,
                                    VerificationCodeGenerator generator, MailSender mail, MailTemplates templates,
                                    KoreanClock clock) {
        this.redis = redis;
        this.guard = guard;
        this.rules = props.verification();
        this.generator = generator;
        this.mail = mail;
        this.templates = templates;
        this.clock = clock;
    }

    private static String key(Purpose p, String email, String suffix) {
        return "verify:" + p.key() + ":" + email + ":" + suffix;
    }

    /**
     * 인증번호를 보낸다. sendMail=false면(비밀번호 찾기에서 가입되지 않은 이메일) 번호를 저장하지 않지만
     * 제한 카운트는 똑같이 올려 계정 유무를 숨긴다 (CF-25-3).
     *
     * @return 번호의 만료 시각과 보낸 번호(보내지 않았으면 null)
     */
    public Sent send(Purpose purpose, String email, boolean sendMail) {
        if (sendMail && !mail.isAvailable()) {
            throw new ApiException(ErrorCode.MAIL_SEND_FAILED);
        }
        return guard.required(() -> {
            var ops = redis.opsForValue();
            String cooldownKey = key(purpose, email, "cooldown");
            if (Boolean.TRUE.equals(redis.hasKey(cooldownKey))) {
                throw new ApiException(ErrorCode.RESEND_TOO_SOON);
            }
            String dailyKey = key(purpose, email, "daily:" + clock.today().format(DAY));
            String daily = ops.get(dailyKey);
            if (daily != null && Integer.parseInt(daily) >= rules.dailyLimit()) {
                throw new ApiException(ErrorCode.DAILY_LIMIT);
            }
            ops.set(cooldownKey, "1", rules.resendInterval());
            Long count = ops.increment(dailyKey);
            if (count != null && count == 1) {
                redis.expire(dailyKey, java.time.Duration.ofHours(24));
            }
            // 새 번호를 받으면 이전 번호·틀린 횟수·인증됨 표시는 모두 무효 (CF-01-15, CF-01-19)
            redis.delete(java.util.List.of(key(purpose, email, "fails"), key(purpose, email, "verified"),
                    key(purpose, email, "confirmed")));
            String code = null;
            if (sendMail) {
                code = generator.generate();
                ops.set(key(purpose, email, "code"), code, rules.codeTtl());
                var m = purpose == Purpose.SIGNUP ? templates.signupCode(code) : templates.resetCode(code);
                mail.send(email, m.subject(), m.body());
            } else {
                redis.delete(key(purpose, email, "code"));
            }
            return new Sent(clock.now().plus(rules.codeTtl()), code);
        });
    }

    public record Sent(Instant expiresAt, String code) {}

    /** 번호를 확인하고 인증됨 표시를 남긴다. 맞으면 번호는 바로 사라진다 (CF-01-15). */
    public Instant confirm(Purpose purpose, String email, String rawCode) {
        String code = rawCode == null ? "" : rawCode.strip().toUpperCase();
        return guard.required(() -> {
            var ops = redis.opsForValue();
            String codeKey = key(purpose, email, "code");
            String failsKey = key(purpose, email, "fails");
            String saved = ops.get(codeKey);
            if (saved == null) {
                String fails = ops.get(failsKey);
                if (fails != null && Integer.parseInt(fails) >= rules.maxAttempts()) {
                    throw new ApiException(ErrorCode.CODE_ATTEMPTS_EXCEEDED);
                }
                throw new ApiException(ErrorCode.CODE_EXPIRED);
            }
            if (!saved.equals(code)) {
                Long fails = ops.increment(failsKey);
                redis.expire(failsKey, rules.codeTtl());
                if (fails != null && fails >= rules.maxAttempts()) {
                    redis.delete(codeKey);
                    throw new ApiException(ErrorCode.CODE_ATTEMPTS_EXCEEDED);
                }
                throw new ApiException(ErrorCode.CODE_MISMATCH);
            }
            redis.delete(java.util.List.of(codeKey, failsKey));
            ops.set(key(purpose, email, "verified"), "1", rules.verifiedTtl());
            // 인증했던 적이 있다는 표시: 시간이 지나 거절할 때 "인증 먼저"와 "시간 초과"를 나눈다
            ops.set(key(purpose, email, "confirmed"), "1", java.time.Duration.ofHours(24));
            return clock.now().plus(rules.verifiedTtl());
        });
    }

    /** 가입·변경 직전 서버가 다시 확인한다 (CF-01-20, CF-25-5). 한 번 쓰면 지운다. */
    public void requireVerified(Purpose purpose, String email) {
        ErrorCode problem = guard.required(() -> {
            if (Boolean.TRUE.equals(redis.hasKey(key(purpose, email, "verified")))) {
                return null;
            }
            return Boolean.TRUE.equals(redis.hasKey(key(purpose, email, "confirmed")))
                    ? ErrorCode.VERIFICATION_EXPIRED : ErrorCode.NOT_VERIFIED;
        });
        if (problem != null) {
            throw new ApiException(problem);
        }
    }

    public void consume(Purpose purpose, String email) {
        guard.optional(() -> redis.delete(java.util.List.of(
                key(purpose, email, "verified"), key(purpose, email, "confirmed"))));
    }

    /** 같은 요청이 처리 중이면 거절한다 (CF-01-10). Redis가 없으면 DB 제약에 맡긴다. */
    public void preventDuplicate(String action, String id) {
        boolean first = guard.optional(() -> redis.opsForValue()
                .setIfAbsent("submit:" + action + ":" + id, "1", java.time.Duration.ofSeconds(5))).orElse(true);
        if (!first) {
            throw new ApiException(ErrorCode.DUPLICATE_SUBMIT);
        }
    }
}
