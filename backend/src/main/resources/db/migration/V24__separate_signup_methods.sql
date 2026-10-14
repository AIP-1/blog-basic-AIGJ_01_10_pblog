-- 계정은 가입한 방법으로만 로그인한다 (v1.9.0). 같은 이메일이어도 소셜 계정을 자동으로 연결하지 않는다.
-- 지금까지 이메일로 가입한 회원(비밀번호가 있는 회원)에 자동으로 붙은 소셜 연결을 끊는다.
-- 그 회원은 이메일과 비밀번호로 로그인한다.
DELETE FROM member_social_accounts s
USING members m
WHERE s.member_id = m.id
  AND m.password_set;
