package com.myblog.member;

import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** member_social_accounts: 소셜 계정과 회원의 연결. */
@Repository
public class SocialAccountRepository {
    private final JdbcClient jdbc;

    public SocialAccountRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Long> findMemberId(SocialProvider provider, String providerUserId) {
        return jdbc.sql("SELECT member_id FROM member_social_accounts WHERE provider = ? AND provider_user_id = ?")
                .params(provider.name(), providerUserId).query(Long.class).optional();
    }

    public void insert(long memberId, SocialProvider provider, String providerUserId, String email,
                       OffsetDateTime now) {
        jdbc.sql("""
                INSERT INTO member_social_accounts (member_id, provider, provider_user_id, email, created_at)
                VALUES (?, ?, ?, ?, ?)""")
                .params(memberId, provider.name(), providerUserId, email, now)
                .update();
    }
}
