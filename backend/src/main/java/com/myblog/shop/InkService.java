package com.myblog.shop;

import com.myblog.common.KoreanClock;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 잉크 지갑과 내역. 늘리고 줄일 때는 지갑 줄을 잠가(FOR UPDATE) 회원마다 한 번에 하나씩 처리한다.
 * 그래서 동시에 글을 여러 개 올려도 하루 한도를 넘지 않고, 잔액은 음수가 되지 않는다.
 */
@Service
public class InkService {
    // 원장 기록의 사유 컬럼·응답 이름
    private static final String REASON = "reason";
    public static final String CHECKIN = "CHECKIN";
    public static final String POST = "POST";
    public static final String COMMENT = "COMMENT";
    public static final String CHALLENGE = "CHALLENGE";
    public static final String PURCHASE = "PURCHASE";

    private final JdbcClient jdbc;
    private final ShopProperties rules;
    private final KoreanClock clock;

    public InkService(JdbcClient jdbc, ShopProperties rules, KoreanClock clock) {
        this.jdbc = jdbc;
        this.rules = rules;
        this.clock = clock;
    }

    /** 지갑이 없으면 만들고 그 줄을 잠근다. 지금 잔액을 돌려준다. */
    private int lockWallet(long memberId) {
        jdbc.sql("INSERT INTO ink_wallets (member_id, balance, updated_at) VALUES (?, 0, ?) ON CONFLICT DO NOTHING")
                .params(memberId, clock.nowOffset()).update();
        return jdbc.sql("SELECT balance FROM ink_wallets WHERE member_id = ? FOR UPDATE").param(memberId)
                .query(Integer.class).single();
    }

    public int balance(long memberId) {
        return jdbc.sql("SELECT balance FROM ink_wallets WHERE member_id = ?").param(memberId)
                .query(Integer.class).optional().orElse(0);
    }

    /**
     * 잉크를 준다. 같은 이유·대상(ref)으로는 한 번만 쌓이고, dailyMax가 0보다 크면 오늘(한국 시간) 그 이유로
     * 받은 횟수가 dailyMax 이상일 때 주지 않는다. 실제로 준 양(안 줬으면 0)을 돌려준다.
     */
    @Transactional
    public int credit(long memberId, int amount, String reason, String ref, int dailyMax) {
        if (amount <= 0) {
            return 0;
        }
        lockWallet(memberId);
        LocalDate today = clock.today();
        if (dailyMax > 0) {
            long n = jdbc.sql("SELECT count(*) FROM ink_ledger_entries WHERE member_id = ? AND reason = ? AND earned_on = ?")
                    .params(memberId, reason, today).query(Long.class).single();
            if (n >= dailyMax) {
                return 0;
            }
        }
        int added = jdbc.sql("""
                INSERT INTO ink_ledger_entries (member_id, amount, reason, ref, earned_on, created_at)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING""")
                .params(memberId, amount, reason, ref, today, clock.nowOffset()).update();
        if (added == 0) {
            return 0;
        }
        jdbc.sql("UPDATE ink_wallets SET balance = balance + ?, updated_at = ? WHERE member_id = ?")
                .params(amount, clock.nowOffset(), memberId).update();
        return amount;
    }

    /** 잉크를 쓴다. 모자라면 INSUFFICIENT_INK (호출한 트랜잭션 전체가 되돌아간다). */
    @Transactional
    public int debit(long memberId, int amount, String reason, String ref) {
        lockWallet(memberId);
        int updated = jdbc.sql("UPDATE ink_wallets SET balance = balance - ?, updated_at = ?"
                        + " WHERE member_id = ? AND balance >= ?")
                .params(amount, clock.nowOffset(), memberId, amount).update();
        if (updated == 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_INK);
        }
        jdbc.sql("""
                INSERT INTO ink_ledger_entries (member_id, amount, reason, ref, earned_on, created_at)
                VALUES (?, ?, ?, ?, ?, ?)""")
                .params(memberId, -amount, reason, ref, clock.today(), clock.nowOffset()).update();
        return balance(memberId);
    }

    /** 공개 글을 새로 올렸을 때 (수정은 해당 없음). 지운 글의 내역도 남아 하루 한도에 들어간다. */
    @Transactional
    public int rewardPost(long memberId, long postId, String visibility) {
        if (!"PUBLIC".equals(visibility)) {
            return 0;
        }
        return credit(memberId, rules.postInk(), POST, String.valueOf(postId), rules.postDailyMax());
    }

    /** 다른 사람 글에 댓글을 달았을 때. 내 글에 단 댓글·답글은 해당 없음. */
    @Transactional
    public int rewardComment(long memberId, long postAuthorId, long commentId) {
        if (memberId == postAuthorId) {
            return 0;
        }
        return credit(memberId, rules.commentInk(), COMMENT, String.valueOf(commentId), rules.commentDailyMax());
    }

    /** 하루 첫 출석. 오늘 이미 했으면 아무것도 주지 않는다. */
    @Transactional
    public Map<String, Object> dailyCheckin(long memberId) {
        int earned = credit(memberId, rules.checkinInk(), CHECKIN, clock.today().toString(), 0);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("earned", earned);
        m.put("balance", balance(memberId));
        m.put("streak", currentStreak(memberId));
        return m;
    }

    public List<LocalDate> checkinDays(long memberId) {
        return jdbc.sql("SELECT earned_on FROM ink_ledger_entries WHERE member_id = ? AND reason = 'CHECKIN' ORDER BY earned_on")
                .param(memberId).query(LocalDate.class).list();
    }

    /** 오늘(또는 어제)까지 이어진 연속 출석 일수 */
    public int currentStreak(long memberId) {
        List<LocalDate> days = checkinDays(memberId);
        if (days.isEmpty()) {
            return 0;
        }
        LocalDate last = days.get(days.size() - 1);
        if (last.isBefore(clock.today().minusDays(1))) {
            return 0;
        }
        int streak = 1;
        for (int i = days.size() - 1; i > 0 && days.get(i - 1).equals(days.get(i).minusDays(1)); i--) {
            streak++;
        }
        return streak;
    }

    /** 지금까지 가장 길게 이어진 연속 출석 일수 (도전과제) */
    public int longestStreak(long memberId) {
        List<LocalDate> days = checkinDays(memberId);
        int best = 0;
        int run = 0;
        LocalDate prev = null;
        for (LocalDate d : days) {
            run = prev != null && d.equals(prev.plusDays(1)) ? run + 1 : 1;
            best = Math.max(best, run);
            prev = d;
        }
        return best;
    }

    /** 내 잉크: 잔액, 오늘 출석 여부, 연속 출석, 오늘 남은 적립 횟수, 최근 내역 */
    public Map<String, Object> wallet(long memberId) {
        LocalDate today = clock.today();
        Map<String, Long> todayCounts = new LinkedHashMap<>();
        jdbc.sql("SELECT reason, count(*) AS n FROM ink_ledger_entries WHERE member_id = ? AND earned_on = ? GROUP BY reason")
                .params(memberId, today)
                .query((rs, i) -> todayCounts.put(rs.getString(REASON), rs.getLong("n"))).list();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("balance", balance(memberId));
        m.put("checkedInToday", todayCounts.getOrDefault(CHECKIN, 0L) > 0);
        m.put("streak", currentStreak(memberId));
        Map<String, Object> earn = new LinkedHashMap<>();
        earn.put("checkin", rules.checkinInk());
        earn.put("post", rules.postInk());
        earn.put("postDailyMax", rules.postDailyMax());
        earn.put("postsToday", todayCounts.getOrDefault(POST, 0L));
        earn.put("comment", rules.commentInk());
        earn.put("commentDailyMax", rules.commentDailyMax());
        earn.put("commentsToday", todayCounts.getOrDefault(COMMENT, 0L));
        m.put("earn", earn);
        m.put("history", jdbc.sql("""
                SELECT e.id, e.amount, e.reason, e.created_at, COALESCE(ch.title, sp.name) AS label
                FROM ink_ledger_entries e
                LEFT JOIN challenges ch ON e.reason = 'CHALLENGE' AND ch.code = e.ref
                LEFT JOIN sticker_packs sp ON e.reason = 'PURCHASE' AND sp.code = e.ref
                WHERE e.member_id = ? ORDER BY e.id DESC LIMIT ?""")
                .params(memberId, rules.historySize())
                .query((rs, i) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getLong("id"));
                    row.put("amount", rs.getInt("amount"));
                    row.put(REASON, rs.getString(REASON));
                    row.put("label", rs.getString("label"));
                    row.put("createdAt", rs.getObject("created_at", OffsetDateTime.class));
                    return row;
                }).list());
        return m;
    }
}
