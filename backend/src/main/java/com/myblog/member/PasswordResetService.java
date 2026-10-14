package com.myblog.member;

import com.myblog.common.KoreanClock;
import com.myblog.mail.MailSender;
import com.myblog.mail.MailTemplates;
import com.myblog.member.EmailVerificationService.Purpose;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 비밀번호 찾기 (CF-25). */
@Service
public class PasswordResetService {
    public record Request(String email, String newPassword, String newPasswordConfirm) {}

    private final MemberRepository members;
    private final PasswordPolicy passwords;
    private final EmailVerificationService verification;
    private final PasswordEncoder encoder;
    private final MemberSessionService sessions;
    private final MailSender mail;
    private final MailTemplates templates;
    private final KoreanClock clock;

    public PasswordResetService(MemberRepository members, PasswordPolicy passwords,
                                EmailVerificationService verification, PasswordEncoder encoder,
                                MemberSessionService sessions, MailSender mail, MailTemplates templates,
                                KoreanClock clock) {
        this.members = members;
        this.passwords = passwords;
        this.verification = verification;
        this.encoder = encoder;
        this.sessions = sessions;
        this.mail = mail;
        this.templates = templates;
        this.clock = clock;
    }

    @Transactional
    public void reset(Request req) {
        String email = EmailNormalizer.normalize(req.email());
        passwords.validate("newPassword", req.newPassword(), "newPasswordConfirm", req.newPasswordConfirm());
        verification.requireVerified(Purpose.RESET, email);
        // 인증은 가입된 이메일에만 번호가 가므로 여기서 회원이 없을 수는 없다. 그래도 같은 응답을 쓴다.
        var member = members.findByEmail(email).filter(m -> !m.withdrawn() && members.passwordSet(m.id()));
        verification.consume(Purpose.RESET, email);
        member.ifPresent(m -> {
            members.updatePassword(m.id(), encoder.encode(req.newPassword()), clock.nowOffset()); // 잠금도 해제 (CF-25-9)
            sessions.expireAll(m.id(), null); // 모든 기기 로그아웃 (CF-25-8)
            var t = templates.passwordChanged();
            mail.send(email, t.subject(), t.body()); // CF-25-10
        });
    }
}
