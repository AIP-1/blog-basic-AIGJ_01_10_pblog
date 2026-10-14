-- V22는 기존 회원을 모두 password_set = true로 채웠다. 그 전(v1.8.0)에 카카오·구글로 가입한 회원도 true가 되어,
-- 정한 적 없는 비밀번호를 물어 탈퇴할 수 없었다. 소셜 가입은 회원과 소셜 연결을 같은 순간에 만드므로
-- 가입 직후 몇 초 안에 연결된 회원을 소셜 가입 회원으로 보고 false로 되돌린다.
-- 그 사이 비밀번호 찾기로 비밀번호를 정한 회원도 false가 되지만, 로그인은 그대로 되고 다시 정하면 true가 된다.
UPDATE members m
SET password_set = false
WHERE m.password_set
  AND EXISTS (SELECT 1
              FROM member_social_accounts s
              WHERE s.member_id = m.id
                AND s.created_at BETWEEN m.created_at AND m.created_at + interval '5 seconds');
