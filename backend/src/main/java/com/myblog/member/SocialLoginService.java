package com.myblog.member;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인 (카카오·구글).
 * <ol>
 *   <li>연결된 소셜 계정이면 그 회원으로 로그인한다. 탈퇴 신청한 회원이면 로그인하지 않는다.</li>
 *   <li>연결은 없지만 인증된 이메일이 가입된 회원의 이메일이면 연결하고 로그인한다.</li>
 *   <li>처음 보는 이메일이면 가입 정보를 세션에 두고 닉네임을 정하는 화면(/social/signup)으로 보낸다.</li>
 *   <li>이메일을 받지 못했거나 제공자가 인증하지 않은 이메일이면 로그인하지 않는다.</li>
 * </ol>
 * 로그인은 비밀번호 로그인과 같은 세션을 쓴다({@link LoginService#startSession}).
 */
@Service
public class SocialLoginService {
    /** 가입 대기 정보를 담는 세션 속성 이름 */
    public static final String PENDING_ATTRIBUTE = "myblog.socialSignup";

    public static final String HOME = "/";
    public static final String SIGNUP_PAGE = "/social/signup";
    public static final String WITHDRAWN = "/?social=withdrawn";
    public static final String NO_EMAIL = "/?social=no-email";
    public static final String FAILED = "/?social=failed";

    private static final Pattern NOT_ALLOWED = Pattern.compile("[^가-힣A-Za-z0-9]");

    /** 소셜 가입을 마치기 전까지 세션에 두는 정보. 세션은 Redis에 저장되므로 Serializable. */
    public record Pending(SocialProvider provider, String providerUserId, String email, String nickname)
            implements Serializable {}

    private final SocialAccountRepository accounts;
    private final MemberRepository members;
    private final SignupService signups;
    private final NicknamePolicy nicknames;
    private final LoginService login;
    private final PasswordEncoder encoder;
    private final SecurityContextRepository contextRepository;
    private final KoreanClock clock;
    private final MyBlogProperties.Member rules;
    private final SecureRandom random = new SecureRandom();

    public SocialLoginService(SocialAccountRepository accounts, MemberRepository members, SignupService signups,
                              NicknamePolicy nicknames, LoginService login, PasswordEncoder encoder,
                              SecurityContextRepository contextRepository, KoreanClock clock, MyBlogProperties props) {
        this.accounts = accounts;
        this.members = members;
        this.signups = signups;
        this.nicknames = nicknames;
        this.login = login;
        this.encoder = encoder;
        this.contextRepository = contextRepository;
        this.clock = clock;
        this.rules = props.member();
    }

    /** 제공자 로그인이 끝난 뒤 부른다. 돌려준 주소로 보낸다. */
    @Transactional
    public String complete(SocialProfile profile, HttpServletRequest req, HttpServletResponse res) {
        if (profile.providerUserId() == null) {
            forgetAuthentication(req, res);
            return FAILED;
        }
        var linked = accounts.findMemberId(profile.provider(), profile.providerUserId()).flatMap(members::findById);
        if (linked.isPresent()) {
            return logInOrRefuse(linked.get(), req, res);
        }
        String email = verifiedEmail(profile);
        if (email == null) {
            forgetAuthentication(req, res);
            return NO_EMAIL;
        }
        var byEmail = members.findByEmail(email);
        if (byEmail.isPresent()) {
            Member m = byEmail.get();
            if (m.withdrawn()) {
                // 탈퇴 신청한 회원의 이메일: 연결하지 않는다. 복구는 이메일 로그인으로 한다
                forgetAuthentication(req, res);
                return WITHDRAWN;
            }
            accounts.insert(m.id(), profile.provider(), profile.providerUserId(), email, clock.nowOffset());
            login.startSession(m, req, res);
            return HOME;
        }
        forgetAuthentication(req, res);
        req.getSession(true).setAttribute(PENDING_ATTRIBUTE,
                new Pending(profile.provider(), profile.providerUserId(), email, suggestNickname(profile.nickname())));
        return SIGNUP_PAGE;
    }

    /** 세션에 있는 가입 대기 정보 */
    public Optional<Pending> pending(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session == null) {
            return Optional.empty();
        }
        return session.getAttribute(PENDING_ATTRIBUTE) instanceof Pending p ? Optional.of(p) : Optional.empty();
    }

    /**
     * 소셜 가입을 마친다: 이메일 가입과 같은 규칙으로 닉네임을 확인하고 회원·블로그를 만든 뒤 연결하고 로그인한다.
     * 이메일 인증은 제공자가 이미 했다. 비밀번호는 아무도 모르는 값으로 두어, 비밀번호 찾기로 정하기 전에는 이메일 로그인이 안 된다.
     */
    @Transactional
    public Member signup(String nicknameRaw, HttpServletRequest req, HttpServletResponse res) {
        Pending p = pending(req).orElseThrow(() -> new ApiException(ErrorCode.SOCIAL_SIGNUP_NOT_FOUND));
        String nickname = nicknames.validate(nicknameRaw);
        long id = signups.createMember(p.email(), nickname, encoder.encode(unguessableSecret()));
        accounts.insert(id, p.provider(), p.providerUserId(), p.email(), clock.nowOffset());
        Member m = members.findById(id).orElseThrow();
        req.getSession().removeAttribute(PENDING_ATTRIBUTE);
        login.startSession(m, req, res);
        return m;
    }

    private String logInOrRefuse(Member m, HttpServletRequest req, HttpServletResponse res) {
        if (m.withdrawn()) {
            forgetAuthentication(req, res);
            return WITHDRAWN;
        }
        login.startSession(m, req, res);
        return HOME;
    }

    /** oauth2Login이 넣어 둔 인증 정보(소셜 토큰)를 지운다. 우리 회원으로 로그인시키지 않을 때 부른다. */
    public void forgetAuthentication(HttpServletRequest req, HttpServletResponse res) {
        SecurityContextHolder.clearContext();
        contextRepository.saveContext(SecurityContextHolder.createEmptyContext(), req, res);
    }

    private static String verifiedEmail(SocialProfile profile) {
        if (profile.email() == null || !profile.emailVerified()) {
            return null;
        }
        try {
            return EmailNormalizer.normalize(profile.email());
        } catch (ApiException e) {
            return null;
        }
    }

    /** 제공자 닉네임에서 쓸 수 있는 글자만 남겨 길이에 맞춘다. 너무 짧으면 빈 값(화면에서 직접 입력). */
    String suggestNickname(String raw) {
        if (raw == null) {
            return "";
        }
        String cleaned = NOT_ALLOWED.matcher(raw).replaceAll("");
        if (cleaned.codePointCount(0, cleaned.length()) > rules.nicknameMax()) {
            cleaned = cleaned.substring(0, cleaned.offsetByCodePoints(0, rules.nicknameMax()));
        }
        return cleaned.codePointCount(0, cleaned.length()) < rules.nicknameMin() ? "" : cleaned;
    }

    private String unguessableSecret() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
