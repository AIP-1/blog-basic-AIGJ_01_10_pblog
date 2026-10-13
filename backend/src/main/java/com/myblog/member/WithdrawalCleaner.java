package com.myblog.member;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.image.ImageService;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 보관 기간이 지난 탈퇴 회원을 정리한다 (CF-15-17~21). 매일 새벽에 돈다.
 * <ul>
 *   <li>지움: 블로그·분류·글(과 그 글의 댓글·좋아요·태그 연결·신고·통계·이미지), 내가 누른 좋아요, 임시저장 글, 내가 올린 이미지,
 *       소셜 로그인 연결</li>
 *   <li>바꿈(익명화): 이메일·닉네임 → del 랜덤값, 비밀번호 해시 → 쓸 수 없는 값, 소개 → 빈 값</li>
 *   <li>남김: 회원 줄(번호), 남의 글에 단 댓글("탈퇴한 사용자"로 보임), 내가 한 신고 기록</li>
 * </ul>
 * 이메일이 바뀌고 소셜 연결도 지우므로, 그 뒤에는 같은 이메일·소셜 계정으로 다시 가입할 수 있다.
 */
@Component
public class WithdrawalCleaner {
    private static final Logger log = LoggerFactory.getLogger(WithdrawalCleaner.class);
    private static final String CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

    private final JdbcClient jdbc;
    private final ImageService images;
    private final TransactionTemplate tx;
    private final KoreanClock clock;
    private final Duration keep;
    private final SecureRandom random = new SecureRandom();

    public WithdrawalCleaner(JdbcClient jdbc, ImageService images, TransactionTemplate tx, KoreanClock clock,
                             MyBlogProperties props) {
        this.jdbc = jdbc;
        this.images = images;
        this.tx = tx;
        this.clock = clock;
        this.keep = props.member().withdrawKeep();
    }

    @Scheduled(cron = "0 40 4 * * *", zone = "Asia/Seoul")
    public void scheduled() {
        int n = cleanUp();
        if (n > 0) {
            log.info("Anonymized {} withdrawn member(s)", n);
        }
    }

    /** 보관 기간이 지난 탈퇴 회원을 한 명씩(각자 트랜잭션) 정리하고, 정리한 수를 돌려준다. */
    public int cleanUp() {
        OffsetDateTime limit = clock.nowOffset().minus(keep);
        List<Long> ids = jdbc.sql("""
                SELECT id FROM members
                WHERE deleted_at IS NOT NULL AND deleted_at <= ? AND anonymized_at IS NULL ORDER BY id""")
                .param(limit).query(Long.class).list();
        ids.forEach(id -> tx.executeWithoutResult(status -> anonymize(id)));
        return ids.size();
    }

    private void anonymize(long id) {
        List<String> keys = jdbc.sql("""
                SELECT storage_key FROM post_images
                WHERE uploader_id = ? OR post_id IN (SELECT id FROM posts WHERE author_id = ?)""")
                .params(id, id).query(String.class).list();
        jdbc.sql("DELETE FROM posts WHERE author_id = ?").param(id).update(); // 분류 RESTRICT보다 먼저
        jdbc.sql("DELETE FROM blogs WHERE owner_id = ?").param(id).update();
        jdbc.sql("DELETE FROM post_likes WHERE member_id = ?").param(id).update();
        jdbc.sql("DELETE FROM drafts WHERE member_id = ?").param(id).update();
        jdbc.sql("DELETE FROM post_images WHERE uploader_id = ?").param(id).update();
        jdbc.sql("DELETE FROM member_social_accounts WHERE member_id = ?").param(id).update(); // 같은 소셜 계정으로 새로 가입할 수 있게

        String nickname = uniqueNickname();
        OffsetDateTime now = clock.nowOffset();
        jdbc.sql("""
                UPDATE members SET email = ?, nickname = ?, nickname_key = ?, password_hash = ?, bio = '',
                       failed_login_count = 0, locked_until = NULL, anonymized_at = ?, updated_at = ?
                WHERE id = ?""")
                // BCrypt 형식이 아닌 값이라 어떤 비밀번호와도 맞지 않는다
                .params("del_" + rand(12) + "@deleted.invalid", nickname, nickname, "!" + rand(40), now, now, id)
                .update();
        images.deleteFilesAfterCommit(keys);
    }

    /** 닉네임 규칙(2~10자 영문·숫자) 안에서 겹치지 않게 */
    private String uniqueNickname() {
        while (true) {
            String nick = "del" + rand(7);
            boolean taken = jdbc.sql("SELECT count(*) FROM members WHERE nickname_key = ?").param(nick)
                    .query(Long.class).single() > 0;
            if (!taken) {
                return nick;
            }
        }
    }

    private String rand(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
