package com.myblog.shop;

import com.myblog.common.KoreanClock;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 스티커 팩 목록 · 팩 사기 · 내 스티커. 팩은 한 번만 살 수 있고, 사면 팩의 스티커를 모두 가진다. */
@Service
public class StickerService {
    // 한정 스티커 여부 (컬럼·응답 이름)
    private static final String LIMITED = "limited";
    private final JdbcClient jdbc;
    private final InkService ink;
    private final KoreanClock clock;

    public StickerService(JdbcClient jdbc, InkService ink, KoreanClock clock) {
        this.jdbc = jdbc;
        this.ink = ink;
        this.clock = clock;
    }

    private record StickerRow(String code, String packCode, String name, boolean limited) {}

    private static Map<String, Object> sticker(StickerRow s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", s.code());
        m.put("name", s.name());
        m.put(LIMITED, s.limited());
        return m;
    }

    /** 상점: 팩마다 스티커 미리보기와 값. 로그인했으면 산 팩 표시 */
    public List<Map<String, Object>> packs(Long viewer) {
        Set<String> owned = new HashSet<>(viewer == null ? List.of()
                : jdbc.sql("SELECT pack_code FROM member_sticker_packs WHERE member_id = ?").param(viewer)
                        .query(String.class).list());
        Map<String, List<Map<String, Object>>> byPack = new LinkedHashMap<>();
        jdbc.sql("SELECT code, pack_code, name, limited FROM stickers WHERE pack_code IS NOT NULL ORDER BY pack_code, sort_order")
                .query(StickerRow.class).list()
                .forEach(s -> byPack.computeIfAbsent(s.packCode(), k -> new ArrayList<>()).add(sticker(s)));
        return jdbc.sql("SELECT code, name, description, price FROM sticker_packs ORDER BY sort_order")
                .query((rs, i) -> {
                    String code = rs.getString("code");
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("code", code);
                    m.put("name", rs.getString("name"));
                    m.put("description", rs.getString("description"));
                    m.put("price", rs.getInt("price"));
                    m.put("owned", owned.contains(code));
                    m.put("stickers", byPack.getOrDefault(code, List.of()));
                    return m;
                }).list();
    }

    /**
     * 팩 사기. 산 팩 기록(기본 키)을 먼저 넣어 같은 팩을 두 번 사지 못하게 하고, 잔액이 모자라면 전부 되돌린다.
     * 남은 잉크를 돌려준다.
     */
    @Transactional
    public Map<String, Object> buy(long memberId, String packCode) {
        Integer price = jdbc.sql("SELECT price FROM sticker_packs WHERE code = ?").param(packCode)
                .query(Integer.class).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.PACK_NOT_FOUND));
        int inserted = jdbc.sql("""
                INSERT INTO member_sticker_packs (member_id, pack_code, purchased_at) VALUES (?, ?, ?)
                ON CONFLICT DO NOTHING""").params(memberId, packCode, clock.nowOffset()).update();
        if (inserted == 0) {
            throw new ApiException(ErrorCode.ALREADY_OWNED);
        }
        int balance = ink.debit(memberId, price, InkService.PURCHASE, packCode);
        jdbc.sql("""
                INSERT INTO member_stickers (member_id, sticker_code, acquired_at)
                SELECT ?, code, ? FROM stickers WHERE pack_code = ? ON CONFLICT DO NOTHING""")
                .params(memberId, clock.nowOffset(), packCode).update();
        return Map.of("balance", balance, "packCode", packCode);
    }

    /** 스티커 하나를 준다 (도전과제 보상). 이미 있으면 그대로 */
    void give(long memberId, String stickerCode) {
        jdbc.sql("INSERT INTO member_stickers (member_id, sticker_code, acquired_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
                .params(memberId, stickerCode, clock.nowOffset()).update();
    }

    /** 내 스티커: 팩 순서, 한정 스티커는 맨 뒤 */
    public List<Map<String, Object>> mine(long memberId) {
        return jdbc.sql("""
                SELECT s.code, s.name, s.limited, sp.name AS pack_name, ms.acquired_at
                FROM member_stickers ms JOIN stickers s ON s.code = ms.sticker_code
                LEFT JOIN sticker_packs sp ON sp.code = s.pack_code
                WHERE ms.member_id = ?
                ORDER BY s.limited, sp.sort_order, s.sort_order""")
                .param(memberId)
                .query((rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("code", rs.getString("code"));
                    m.put("name", rs.getString("name"));
                    m.put(LIMITED, rs.getBoolean(LIMITED));
                    m.put("packName", rs.getString("pack_name"));
                    m.put("acquiredAt", rs.getObject("acquired_at", OffsetDateTime.class));
                    return m;
                }).list();
    }

    /** 이 스티커들을 모두 가졌는지 */
    boolean ownsAll(long memberId, Set<String> codes) {
        if (codes.isEmpty()) {
            return true;
        }
        long n = jdbc.sql("SELECT count(*) FROM member_stickers WHERE member_id = :me AND sticker_code IN (:codes)")
                .param("me", memberId).param("codes", codes).query(Long.class).single();
        return n == codes.size();
    }
}
