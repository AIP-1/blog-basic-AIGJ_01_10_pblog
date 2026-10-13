-- 회원이 직접 정한 비밀번호가 있는지. 소셜로 가입하면 false로 시작하고, 비밀번호 찾기로 정하면 true가 된다.
-- false인 회원은 마이페이지에서 비밀번호 변경을 숨기고, 탈퇴할 때 비밀번호 대신 확인 문구를 받는다.
ALTER TABLE members ADD COLUMN password_set boolean NOT NULL DEFAULT true;
