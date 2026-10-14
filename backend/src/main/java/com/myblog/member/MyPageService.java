package com.myblog.member;

import com.myblog.blog.BlogService;
import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import com.myblog.mail.MailSender;
import com.myblog.mail.MailTemplates;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 마이페이지: 내 정보, 비밀번호 변경, 탈퇴 (CF-15). */
@Service
public class MyPageService {
    public record ProfileUpdate(String nickname, String bio) {}

    public record PasswordChange(String currentPassword, String newPassword, String newPasswordConfirm) {}

    /** password: 비밀번호를 정한 회원. confirmText: 비밀번호가 없는 소셜 가입 회원은 {@link #WITHDRAW_PHRASE}를 그대로 적는다. */
    public record Withdraw(String password, Boolean acknowledged, String confirmText) {}

    public static final String WITHDRAW_PHRASE = "탈퇴합니다";

    private final MemberRepository members;
    private final SocialAccountRepository socialAccounts;
    private final NicknamePolicy nicknames;
    private final PasswordPolicy passwords;
    private final LoginService login;
    private final PasswordEncoder encoder;
    private final MemberSessionService sessions;
    private final MailSender mail;
    private final MailTemplates templates;
    private final BlogService blogs;
    private final MyBlogProperties props;
    private final KoreanClock clock;

    public MyPageService(MemberRepository members, SocialAccountRepository socialAccounts, NicknamePolicy nicknames, PasswordPolicy passwords,
                         LoginService login, PasswordEncoder encoder, MemberSessionService sessions, MailSender mail,
                         MailTemplates templates, BlogService blogs,
                         MyBlogProperties props, KoreanClock clock) {
        this.members = members;
        this.socialAccounts = socialAccounts;
        this.nicknames = nicknames;
        this.passwords = passwords;
        this.login = login;
        this.encoder = encoder;
        this.sessions = sessions;
        this.mail = mail;
        this.templates = templates;
        this.blogs = blogs;
        this.props = props;
        this.clock = clock;
    }

    private Member member(long id) {
        return members.findById(id).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
    }

    public Map<String, Object> view(long memberId) {
        Member m = member(memberId);
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("email", m.email());
        v.put("nickname", m.nickname());
        v.put("bio", m.bio());
        v.put("createdAt", m.createdAt());
        v.put("blogId", blogs.blogIdOf(memberId).orElse(null));
        v.put("passwordSet", members.passwordSet(memberId));
        v.put("socialAccounts", socialAccounts.providersOf(memberId).stream().map(SocialProvider::registrationId).toList());
        return v;
    }

    @Transactional
    public void updateProfile(long memberId, ProfileUpdate req) {
        Member m = member(memberId);
        String nickname = req.nickname() == null ? m.nickname() : nicknames.validate(req.nickname());
        String bio = req.bio() == null ? m.bio() : Texts.trim(req.bio());
        if (Texts.length(bio) > props.member().bioMax()) {
            throw ApiException.field("bio", Messages.BIO_RULE);
        }
        if (members.existsByNicknameKey(NicknamePolicy.key(nickname), memberId)) { // 내 닉네임은 중복 아님 (CF-15-5)
            throw ApiException.withDetails(ErrorCode.NICKNAME_TAKEN, Messages.NICKNAME_TAKEN,
                    Map.of("fields", Map.of("nickname", Messages.NICKNAME_TAKEN)));
        }
        members.updateProfile(memberId, nickname, NicknamePolicy.key(nickname), bio, clock.nowOffset());
    }

    /** 지금 기기는 유지하고 다른 기기의 로그인을 끊는다 (CF-15-15). */
    @Transactional
    public void changePassword(long memberId, String currentSessionId, PasswordChange req) {
        Member m = member(memberId);
        if (!members.passwordSet(memberId)) { // 소셜 가입 회원은 비밀번호 찾기로 처음 정한다
            throw new ApiException(ErrorCode.PASSWORD_NOT_SET);
        }
        login.verifyPassword(m, req.currentPassword(), ErrorCode.CURRENT_PASSWORD_MISMATCH);
        passwords.validate("newPassword", req.newPassword(), "newPasswordConfirm", req.newPasswordConfirm());
        if (encoder.matches(req.newPassword(), m.passwordHash())) {
            throw ApiException.withDetails(ErrorCode.SAME_AS_CURRENT, Messages.SAME_AS_CURRENT,
                    Map.of("fields", Map.of("newPassword", Messages.SAME_AS_CURRENT)));
        }
        members.updatePassword(memberId, encoder.encode(req.newPassword()), clock.nowOffset());
        sessions.expireAll(memberId, currentSessionId);
        var t = templates.passwordChanged();
        mail.send(m.email(), t.subject(), t.body()); // CF-15-16
    }

    /**
     * 탈퇴 (CF-15-17~21): 소프트 삭제. 비밀번호로 확인하고, 비밀번호가 없는 소셜 가입 회원은 확인 문구로 확인한다. deleted_at만 찍고 모든 기기에서 로그아웃한다.
     * 그때부터 블로그와 글은 다른 사람에게 보이지 않고, 댓글은 "탈퇴한 사용자"로 보인다.
     * 보관 기간 안에 로그인하면 복구할 수 있고, 지나면 {@link WithdrawalCleaner}가 지우고 익명화한다.
     */
    @Transactional
    public void withdraw(long memberId, Withdraw req) {
        Member m = member(memberId);
        if (!Boolean.TRUE.equals(req.acknowledged())) {
            throw new ApiException(ErrorCode.ACKNOWLEDGE_REQUIRED);
        }
        if (members.passwordSet(memberId)) {
            login.verifyPassword(m, req.password(), ErrorCode.CURRENT_PASSWORD_MISMATCH);
        } else if (!WITHDRAW_PHRASE.equals(Texts.trim(req.confirmText()))) {
            throw ApiException.field("confirmText", Messages.WITHDRAW_PHRASE_MISMATCH);
        }
        members.markWithdrawn(memberId, clock.nowOffset());
        sessions.expireAll(memberId, null);
    }
}
