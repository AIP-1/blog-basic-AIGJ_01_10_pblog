package com.myblog.member;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 로그인과 잠금 (CF-02-3~9, NF-12). */
@Service
public class LoginService {
    private final MemberRepository members;
    private final SocialAccountRepository socialAccounts;
    private final PasswordEncoder encoder;
    private final MyBlogProperties.Login rules;
    private final java.time.Duration withdrawKeep;
    private final KoreanClock clock;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final SecurityContextRepository contextRepository;
    // 없는 이메일에도 같은 시간을 쓰게 해 응답 시간으로 가입 여부를 짐작하지 못하게 한다
    private final String dummyHash;

    public LoginService(MemberRepository members, SocialAccountRepository socialAccounts, PasswordEncoder encoder,
                        MyBlogProperties props, KoreanClock clock, SessionAuthenticationStrategy sessionStrategy,
                        SecurityContextRepository contextRepository) {
        this.members = members;
        this.socialAccounts = socialAccounts;
        this.encoder = encoder;
        this.rules = props.login();
        this.withdrawKeep = props.member().withdrawKeep();
        this.clock = clock;
        this.sessionStrategy = sessionStrategy;
        this.contextRepository = contextRepository;
        this.dummyHash = encoder.encode("dummy-password-1!");
    }

    /**
     * 탈퇴 신청한 회원은 비밀번호가 맞아도 로그인하지 않고 ACCOUNT_WITHDRAWN으로 알린다.
     * 화면이 복구할지 묻고, 그러겠다고 하면 {@link #restore}를 부른다.
     */
    public Member login(String rawEmail, String password, HttpServletRequest req, HttpServletResponse res) {
        Member m = authenticate(rawEmail, password);
        if (m.withdrawn()) {
            throw ApiException.withDetails(ErrorCode.ACCOUNT_WITHDRAWN, Messages.ACCOUNT_WITHDRAWN,
                    Map.of("restorableUntil", m.deletedAt().plus(withdrawKeep)
                            .atZoneSameInstant(KoreanClock.SEOUL).toOffsetDateTime()));
        }
        startSession(m, req, res);
        return m;
    }

    /** 탈퇴 복구 (보관 기간 안): 비밀번호를 다시 확인하고 탈퇴 표시를 지운 뒤 로그인한다. */
    @Transactional
    public Member restore(String rawEmail, String password, HttpServletRequest req, HttpServletResponse res) {
        Member m = authenticate(rawEmail, password);
        if (!m.withdrawn()) {
            throw new ApiException(ErrorCode.LOGIN_FAILED);
        }
        members.restore(m.id(), clock.nowOffset());
        startSession(m, req, res);
        return members.findById(m.id()).orElseThrow();
    }

    private Member authenticate(String rawEmail, String password) {
        String email = rawEmail == null ? "" : rawEmail.strip().toLowerCase(java.util.Locale.ROOT);
        var found = members.findByEmail(email);
        if (found.isEmpty()) {
            encoder.matches(password == null ? "" : password, dummyHash);
            throw new ApiException(ErrorCode.LOGIN_FAILED);
        }
        Member m = found.get();
        refuseSocialAccount(m);
        verifyPassword(m, password, ErrorCode.LOGIN_FAILED);
        members.clearFailures(m.id());
        return m;
    }

    /** 소셜로 가입한 계정은 가입한 방법으로만 로그인한다. 이메일 로그인이면 어느 제공자로 로그인할지 알려 준다. */
    private void refuseSocialAccount(Member m) {
        if (members.passwordSet(m.id())) {
            return;
        }
        var provider = socialAccounts.signupProviderOf(m.id());
        String message = provider.map(p -> Messages.socialAccount(p.displayName())).orElse(Messages.SOCIAL_ACCOUNT);
        throw ApiException.withDetails(ErrorCode.SOCIAL_ACCOUNT, message,
                provider.<Map<String, Object>>map(p -> Map.of("provider", p.registrationId())).orElse(Map.of()));
    }

    /**
     * 로그인 세션을 연다: 세션 ID를 새로 받고, 회원별 세션 목록에 넣고, 회원 번호를 인증 정보로 저장한다.
     * 비밀번호 로그인과 소셜 로그인이 같이 쓴다. 이미 있던 인증 정보(소셜 로그인 토큰 등)는 이것으로 바뀐다.
     */
    public void startSession(Member m, HttpServletRequest req, HttpServletResponse res) {
        var auth = new UsernamePasswordAuthenticationToken(m.id(), null,
                List.of(new SimpleGrantedAuthority("ROLE_MEMBER")));
        req.getSession(true);
        sessionStrategy.onAuthentication(auth, req, res); // 세션 ID 새로 발급 + 회원별 세션 목록에 등록
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, req, res);
    }

    /**
     * 비밀번호를 확인한다. 잠겨 있으면 맞아도 거절하고, 틀리면 실패 횟수를 올린다.
     * 마이페이지의 현재 비밀번호 확인도 이 횟수에 합산한다 (CF-15-14).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public void verifyPassword(Member m, String password, ErrorCode wrongPasswordCode) {
        OffsetDateTime now = clock.nowOffset();
        if (m.lockedUntil() != null && m.lockedUntil().isAfter(now)) {
            throw locked(m.lockedUntil(), now);
        }
        int failures = m.lockedUntil() != null ? 0 : m.failedLoginCount(); // 잠금이 풀렸으면 0부터 (CF-02-7)
        if (password == null || !encoder.matches(password, m.passwordHash())) {
            failures++;
            if (failures >= rules.maxFailures()) {
                OffsetDateTime until = now.plus(rules.lockDuration());
                members.recordFailure(m.id(), 0, until);
                throw locked(until, now);
            }
            members.recordFailure(m.id(), failures, null);
            throw new ApiException(wrongPasswordCode);
        }
    }

    private static ApiException locked(OffsetDateTime until, OffsetDateTime now) {
        long minutes = Math.max(1, (Duration.between(now, until).toSeconds() + 59) / 60);
        return ApiException.withDetails(ErrorCode.ACCOUNT_LOCKED, Messages.accountLocked(minutes),
                Map.of("unlockAt", until.atZoneSameInstant(com.myblog.common.KoreanClock.SEOUL).toOffsetDateTime()));
    }
}
