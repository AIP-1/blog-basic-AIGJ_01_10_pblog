package com.myblog.member;

import com.myblog.blog.BlogService;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.mail.MailSender;
import com.myblog.mail.MailTemplates;
import com.myblog.manage.NewCommentCounter;
import com.myblog.member.EmailVerificationService.Purpose;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** contracts/api.md '회원·인증'. */
@RestController
public class AuthController {
    // 응답에서 회원 정보를 담는 이름
    private static final String MEMBER = "member";
    public record VerificationRequest(String purpose, String email, String nickname) {}

    public record ConfirmRequest(String purpose, String email, String code) {}

    public record LoginRequest(String email, String password) {}

    private final EmailVerificationService verification;
    private final SignupService signup;
    private final LoginService login;
    private final PasswordResetService reset;
    private final MemberRepository members;
    private final SocialAccountRepository socialAccounts;
    private final MailSender mailSender;
    private final MailTemplates templates;
    private final BlogService blogs;
    private final NewCommentCounter newComments;
    private final String mailMode;

    public AuthController(EmailVerificationService verification, SignupService signup, LoginService login,
                          PasswordResetService reset, MemberRepository members, SocialAccountRepository socialAccounts,
                          MailSender mailSender, MailTemplates templates, BlogService blogs,
                          NewCommentCounter newComments, com.myblog.common.MyBlogProperties props) {
        this.socialAccounts = socialAccounts;
        this.mailSender = mailSender;
        this.templates = templates;
        this.mailMode = props.mail().mode();
        this.verification = verification;
        this.signup = signup;
        this.login = login;
        this.reset = reset;
        this.members = members;
        this.blogs = blogs;
        this.newComments = newComments;
    }

    /** 앱 시작 시 한 번 불러 XSRF-TOKEN 쿠키를 받는다. */
    @GetMapping("/api/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @PostMapping("/api/auth/verifications")
    public ResponseEntity<Map<String, Object>> sendCode(@RequestBody VerificationRequest req) {
        Purpose purpose = Purpose.parse(req.purpose());
        String email = EmailNormalizer.normalize(req.email());
        boolean sendMail;
        java.util.Optional<SocialProvider> socialProvider = java.util.Optional.empty();
        if (purpose == Purpose.SIGNUP) {
            signup.checkAvailable(email, req.nickname());
            sendMail = true;
        } else {
            // 가입 여부와 관계없이 같은 응답 (CF-25-3), 탈퇴 신청한 회원 제외.
            // 소셜로 가입한 회원은 비밀번호가 없으니 번호 대신 어느 제공자로 로그인하면 되는지 메일로 알린다
            var active = members.findByEmail(email).filter(m -> !m.withdrawn());
            socialProvider = active.filter(m -> !members.passwordSet(m.id()))
                    .flatMap(m -> socialAccounts.signupProviderOf(m.id()));
            sendMail = active.isPresent() && socialProvider.isEmpty();
        }
        var sent = verification.send(purpose, email, sendMail);
        socialProvider.ifPresent(p -> {
            var notice = templates.socialAccountNoPassword(p.displayName());
            mailSender.send(email, notice.subject(), notice.body());
        });
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("expiresAt", sent.expiresAt());
        // 메일 서버가 없는 동안(mode=log) 가입 인증번호만 화면에 바로 보여 준다. 메일을 연결하면 사라진다.
        // 비밀번호 찾기 번호는 보여 주지 않는다. 보여 주면 남의 이메일로 비밀번호를 바꿀 수 있다.
        if ("log".equals(mailMode) && purpose == Purpose.SIGNUP && sent.code() != null) {
            body.put("devCode", sent.code());
        }
        return ResponseEntity.accepted().body(body);
    }

    @PostMapping("/api/auth/verifications/confirm")
    public Map<String, Object> confirm(@RequestBody ConfirmRequest req) {
        Purpose purpose = Purpose.parse(req.purpose());
        String email = EmailNormalizer.normalize(req.email());
        return Map.of("verifiedUntil", verification.confirm(purpose, email, req.code()));
    }

    @PostMapping("/api/auth/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody SignupService.Request req) {
        String email = EmailNormalizer.normalize(req.email());
        verification.preventDuplicate("signup", email); // CF-01-10
        long id = signup.signup(req);
        return ResponseEntity.status(201).body(Map.of("id", id));
    }

    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@RequestBody LoginRequest req, HttpServletRequest httpReq,
                                     HttpServletResponse httpRes) {
        Member m = login.login(req.email(), req.password(), httpReq, httpRes);
        return Map.of(MEMBER, memberView(m));
    }

    @PostMapping("/api/auth/restore")
    public Map<String, Object> restore(@RequestBody LoginRequest req, HttpServletRequest httpReq,
                                       HttpServletResponse httpRes) {
        Member m = login.restore(req.email(), req.password(), httpReq, httpRes);
        return Map.of(MEMBER, memberView(m));
    }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/auth/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal Long memberId) {
        if (memberId == null) {
            return ResponseEntity.noContent().build();
        }
        var member = members.findById(memberId);
        if (member.isEmpty() || member.get().withdrawn()) {
            return ResponseEntity.noContent().build();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put(MEMBER, memberView(member.get()));
        var blogId = blogs.blogIdOf(memberId);
        body.put("blog", blogId.map(id -> {
            var b = blogs.get(id);
            return Map.<String, Object>of("id", id, "name", b.name(), "topicCode", b.topicCode());
        }).orElse(null));
        body.put("newCommentCount", blogId.map(id -> newComments.count(id, memberId)).orElse(0L));
        return ResponseEntity.ok(body);
    }

    @PostMapping("/api/auth/password-reset")
    public ResponseEntity<Void> resetPassword(@RequestBody PasswordResetService.Request req,
                                              @AuthenticationPrincipal Long memberId) {
        if (memberId != null) {
            throw new ApiException(ErrorCode.FORBIDDEN); // 로그인 상태에서는 마이페이지를 쓴다 (CF-25-1)
        }
        reset.reset(req);
        return ResponseEntity.ok().build();
    }

    static Map<String, Object> memberView(Member m) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", m.id());
        v.put("email", m.email());
        v.put("nickname", m.nickname());
        v.put("bio", m.bio());
        return v;
    }
}
