-- 소셜 로그인 연결: 카카오·구글 계정 하나는 회원 한 명에게만 묶인다. 회원이 지워지면 함께 지운다.
-- 탈퇴 회원을 익명화할 때(WithdrawalCleaner)도 연결을 지운다. 그 뒤에는 같은 소셜 계정으로 새로 가입할 수 있다.
CREATE TABLE member_social_accounts (
    id               bigserial    PRIMARY KEY,
    member_id        bigint       NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    provider         varchar(20)  NOT NULL,
    provider_user_id varchar(255) NOT NULL,
    email            varchar(254),             -- 연결할 때 제공자가 알려 준 이메일 (기록용)
    created_at       timestamptz  NOT NULL,
    CONSTRAINT ck_member_social_accounts_provider CHECK (provider IN ('KAKAO', 'GOOGLE')),
    CONSTRAINT uk_member_social_accounts_provider_user UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_member_social_accounts_member_id ON member_social_accounts (member_id);
