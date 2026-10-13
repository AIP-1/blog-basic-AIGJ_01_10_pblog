package com.myblog.member;

import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 소셜 가입 마무리: 제공자 로그인 뒤 처음 온 사람이 닉네임을 정한다. */
@RestController
public class SocialAuthController {
    public record SignupRequest(String nickname) {}

    private final SocialLoginService social;
    private final EmailVerificationService verification;

    public SocialAuthController(SocialLoginService social, EmailVerificationService verification) {
        this.social = social;
        this.verification = verification;
    }

    /** 세션에 있는 가입 대기 정보. 없으면 SOCIAL_SIGNUP_NOT_FOUND(404). */
    @GetMapping("/api/auth/social/pending")
    public Map<String, Object> pending(HttpServletRequest req) {
        var p = social.pending(req).orElseThrow(() -> new ApiException(ErrorCode.SOCIAL_SIGNUP_NOT_FOUND));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("provider", p.provider().registrationId());
        body.put("email", p.email());
        body.put("nickname", p.nickname());
        return body;
    }

    /** 가입하고 바로 로그인한다. 응답은 이메일 가입(id)과 로그인(member)을 합친 모양. */
    @PostMapping("/api/auth/social/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody SignupRequest req, HttpServletRequest httpReq,
                                                      HttpServletResponse httpRes) {
        var p = social.pending(httpReq).orElseThrow(() -> new ApiException(ErrorCode.SOCIAL_SIGNUP_NOT_FOUND));
        verification.preventDuplicate("social-signup", p.provider().name() + ":" + p.providerUserId());
        Member m = social.signup(req.nickname(), httpReq, httpRes);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", m.id());
        body.put("member", AuthController.memberView(m));
        return ResponseEntity.status(201).body(body);
    }
}
