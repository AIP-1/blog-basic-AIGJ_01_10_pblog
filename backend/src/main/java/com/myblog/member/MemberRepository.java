package com.myblog.member;

import com.myblog.common.ResponseCache;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class MemberRepository {
    private static final String COLUMNS =
            "id, email, nickname, password_hash, bio, failed_login_count, locked_until, created_at, deleted_at";
    private final JdbcClient jdbc;
    private final ResponseCache cache;

    public MemberRepository(JdbcClient jdbc, ResponseCache cache) {
        this.jdbc = jdbc;
        this.cache = cache;
    }

    public Optional<Member> findById(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM members WHERE id = ?").param(id).query(Member.class).optional();
    }

    public Optional<Member> findByEmail(String email) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM members WHERE email = ?").param(email).query(Member.class).optional();
    }

    /** 탈퇴 신청한 회원도 포함한다 (보관 기간에는 같은 이메일로 다시 가입할 수 없다). */
    public boolean existsByEmail(String email) {
        return jdbc.sql("SELECT count(*) FROM members WHERE email = ?").param(email).query(Long.class).single() > 0;
    }

    public boolean existsActiveByEmail(String email) {
        return jdbc.sql("SELECT count(*) FROM members WHERE email = ? AND deleted_at IS NULL").param(email)
                .query(Long.class).single() > 0;
    }

    public void markWithdrawn(long id, OffsetDateTime now) {
        jdbc.sql("UPDATE members SET deleted_at = ?, updated_at = ? WHERE id = ?").params(now, now, id).update();
        cache.invalidate(); // 탈퇴한 회원의 글은 메인에서 바로 빠진다
    }

    public void restore(long id, OffsetDateTime now) {
        jdbc.sql("UPDATE members SET deleted_at = NULL, updated_at = ? WHERE id = ? AND anonymized_at IS NULL")
                .params(now, id).update();
        cache.invalidate();
    }

    public boolean existsByNicknameKey(String key, Long exceptId) {
        return jdbc.sql("SELECT count(*) FROM members WHERE nickname_key = ? AND id <> ?")
                .params(key, exceptId == null ? -1L : exceptId).query(Long.class).single() > 0;
    }

    public long insert(String email, String nickname, String nicknameKey, String passwordHash, OffsetDateTime now) {
        var keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO members (email, nickname, nickname_key, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)""")
                .params(email, nickname, nicknameKey, passwordHash, now, now)
                .update(keys, "id");
        return keys.getKey().longValue();
    }

    public void recordFailure(long id, int newCount, OffsetDateTime lockedUntil) {
        jdbc.sql("UPDATE members SET failed_login_count = ?, locked_until = ? WHERE id = ?")
                .params(newCount, lockedUntil, id).update();
    }

    public void clearFailures(long id) {
        jdbc.sql("UPDATE members SET failed_login_count = 0, locked_until = NULL WHERE id = ?").param(id).update();
    }

    public void updatePassword(long id, String hash, OffsetDateTime now) {
        jdbc.sql("""
                UPDATE members SET password_hash = ?, password_set = true, failed_login_count = 0, locked_until = NULL,
                       updated_at = ? WHERE id = ?""")
                .params(hash, now, id).update();
    }

    /** 직접 정한 비밀번호가 있는지. 이메일로 가입한 회원은 true, 소셜로 가입한 회원은 false. */
    public boolean passwordSet(long id) {
        return jdbc.sql("SELECT password_set FROM members WHERE id = ?").param(id).query(Boolean.class).single();
    }

    /** 소셜 가입: 비밀번호는 아무도 모르는 값이라 아직 정하지 않은 것으로 둔다. */
    public void markPasswordUnset(long id) {
        jdbc.sql("UPDATE members SET password_set = false WHERE id = ?").param(id).update();
    }

    public void updateProfile(long id, String nickname, String nicknameKey, String bio, OffsetDateTime now) {
        jdbc.sql("UPDATE members SET nickname = ?, nickname_key = ?, bio = ?, updated_at = ? WHERE id = ?")
                .params(nickname, nicknameKey, bio, now, id).update();
    }
}
