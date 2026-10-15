package com.myblog.member;

import com.myblog.blog.BlogService;
import com.myblog.common.KoreanClock;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import com.myblog.member.EmailVerificationService.Purpose;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 가입 (CF-01, CF-14, CF-03-2, CF-03-3). */
@Service
public class SignupService {
    // 오류 details의 칸별 문구 이름과 이메일 칸 이름
    private static final String FIELDS = "fields";
    private static final String EMAIL = "email";
    public record Request(String nickname, String email, String password, String passwordConfirm) {}

    private final MemberRepository members;
    private final SocialAccountRepository socialAccounts;
    private final NicknamePolicy nicknames;
    private final PasswordPolicy passwords;
    private final EmailVerificationService verification;
    private final PasswordEncoder encoder;
    private final BlogService blogs;
    private final KoreanClock clock;

    public SignupService(MemberRepository members, SocialAccountRepository socialAccounts, NicknamePolicy nicknames,
                         PasswordPolicy passwords, EmailVerificationService verification, PasswordEncoder encoder,
                         BlogService blogs, KoreanClock clock) {
        this.members = members;
        this.socialAccounts = socialAccounts;
        this.nicknames = nicknames;
        this.passwords = passwords;
        this.verification = verification;
        this.encoder = encoder;
        this.blogs = blogs;
        this.clock = clock;
    }

    /** 인증번호를 보내기 전에 이메일·닉네임 중복을 검사한다 (CF-14-1: 가입된 이메일에는 보내지 않는다). */
    public void checkAvailable(String email, String nicknameRaw) {
        if (members.findByEmail(email).filter(Member::withdrawn).isPresent()) {
            throw ApiException.withDetails(ErrorCode.EMAIL_WITHDRAWN, ErrorCode.EMAIL_WITHDRAWN.message(),
                    java.util.Map.of(FIELDS, java.util.Map.of(EMAIL, ErrorCode.EMAIL_WITHDRAWN.message())));
        }
        var taken = members.findByEmail(email);
        if (taken.isPresent() && !members.passwordSet(taken.get().id())) {
            // 소셜로 가입한 이메일: 어느 제공자로 로그인하면 되는지 알려 준다
            var provider = socialAccounts.signupProviderOf(taken.get().id());
            if (provider.isPresent()) {
                String message = Messages.socialEmailTaken(provider.get().displayName());
                throw ApiException.withDetails(ErrorCode.EMAIL_TAKEN, message, java.util.Map.of(
                        FIELDS, java.util.Map.of(EMAIL, message), "provider", provider.get().registrationId()));
            }
        }
        if (taken.isPresent()) {
            throw ApiException.withDetails(ErrorCode.EMAIL_TAKEN, ErrorCode.EMAIL_TAKEN.message(),
                    java.util.Map.of(FIELDS, java.util.Map.of(EMAIL, ErrorCode.EMAIL_TAKEN.message())));
        }
        if (nicknameRaw != null) {
            String nickname = nicknames.validate(nicknameRaw);
            if (members.existsByNicknameKey(NicknamePolicy.key(nickname), null)) {
                throw ApiException.withDetails(ErrorCode.NICKNAME_TAKEN, ErrorCode.NICKNAME_TAKEN.message(),
                        java.util.Map.of(FIELDS, java.util.Map.of("nickname", ErrorCode.NICKNAME_TAKEN.message())));
            }
        }
    }

    @Transactional
    public long signup(Request req) {
        String nickname = nicknames.validate(req.nickname());
        String email = EmailNormalizer.normalize(req.email());
        passwords.validate("password", req.password(), "passwordConfirm", req.passwordConfirm());
        verification.requireVerified(Purpose.SIGNUP, email); // 화면을 건너뛴 요청도 거절 (CF-01-20)
        long id = createMember(email, nickname, encoder.encode(req.password()));
        verification.consume(Purpose.SIGNUP, email);
        return id;
    }

    /**
     * 회원을 만든다: 중복 검사 → 회원 줄 → 블로그와 기본 다이어리. 이메일 가입과 소셜 가입이 같이 쓴다.
     * email은 정규화한 값, nickname은 {@link NicknamePolicy#validate}를 거친 값을 준다.
     */
    @Transactional
    public long createMember(String email, String nickname, String passwordHash) {
        checkAvailable(email, nickname); // 인증하는 사이 먼저 가입한 경우 (CF-01-21)
        long id;
        try {
            id = members.insert(email, nickname, NicknamePolicy.key(nickname), passwordHash, clock.nowOffset());
        } catch (DuplicateKeyException e) {
            checkAvailable(email, nickname);
            throw e;
        }
        blogs.createFor(id, nickname);
        return id;
    }
}
