package com.myblog.shop;

import com.myblog.blog.BlogService;
import com.myblog.blog.CategoryService;
import com.myblog.blog.SubscriptionService;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 다이어리 표지에 붙인 스티커. 주인만, 가진 스티커만, 다이어리마다 stickersPerDiary개까지 붙인다. */
@Service
public class DiaryStickerService {
    public static final Set<String> SLOTS = Set.of("TL", "TR", "BL", "BR", "C");
    public static final Set<Integer> ROTATIONS = Set.of(-15, -8, 0, 8, 15);

    public record Placement(String slot, String code, Integer rotation) {}

    private final JdbcClient jdbc;
    private final BlogService blogs;
    private final CategoryService categories;
    private final StickerService stickers;
    private final ShopProperties rules;

    public DiaryStickerService(JdbcClient jdbc, BlogService blogs, CategoryService categories, StickerService stickers,
                               ShopProperties rules) {
        this.jdbc = jdbc;
        this.blogs = blogs;
        this.categories = categories;
        this.stickers = stickers;
        this.rules = rules;
    }

    /**
     * 여러 다이어리의 표지 스티커를 한 번에: { 다이어리 번호: [{slot, code, rotation}] }.
     * 다이어리를 볼 수 있는 사람에게만 준다: 공개는 누구나, 구독자만은 구독자와 주인, 비공개는 주인만.
     */
    public Map<String, List<Map<String, Object>>> of(List<Long> categoryIds, Long viewer) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        if (categoryIds == null || categoryIds.isEmpty()) {
            return out;
        }
        List<Long> ids = categoryIds.stream().distinct().limit(100).toList();
        jdbc.sql("SELECT ds.category_id, ds.slot, ds.sticker_code, ds.rotation"
                        + " FROM diary_stickers ds JOIN categories c ON c.id = ds.category_id JOIN blogs b ON b.id = c.blog_id"
                        + " WHERE ds.category_id IN (:ids) AND (c.visibility = 'PUBLIC' OR b.owner_id = :viewer"
                        + " OR (c.visibility = 'SUBSCRIBERS' AND " + SubscriptionService.SUBSCRIBED_TO_DIARY + "))"
                        + " ORDER BY ds.category_id, ds.slot")
                .param("ids", ids).param("viewer", viewer == null ? -1L : viewer)
                .query((rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("slot", rs.getString("slot"));
                    m.put("code", rs.getString("sticker_code"));
                    m.put("rotation", rs.getInt("rotation"));
                    out.computeIfAbsent(String.valueOf(rs.getLong("category_id")), k -> new ArrayList<>()).add(m);
                    return m;
                }).list();
        return out;
    }

    /** 표지 스티커를 통째로 바꾼다 (빈 목록이면 모두 뗀다) */
    @Transactional
    public List<Map<String, Object>> replace(long categoryId, long memberId, List<Placement> raw) {
        long blogId = blogs.requireOwnBlogId(memberId);
        if (categories.get(categoryId).blogId() != blogId) {
            throw new ApiException(ErrorCode.CATEGORY_NOT_FOUND);
        }
        List<Placement> list = raw == null ? List.of() : raw;
        int max = rules.stickersPerDiary();
        if (list.size() > max) {
            throw new ApiException(ErrorCode.TOO_MANY_STICKERS, Messages.tooManyStickers(max), Map.of(), Map.of());
        }
        validatePlacements(list);
        Set<String> codes = list.stream().map(Placement::code).collect(Collectors.toSet());
        if (!stickers.ownsAll(memberId, codes)) {
            throw new ApiException(ErrorCode.STICKER_NOT_OWNED);
        }
        // 다이어리 줄을 잠가 동시에 저장해도 한도를 넘지 않게 한다
        jdbc.sql("SELECT id FROM categories WHERE id = ? FOR UPDATE").param(categoryId).query(Long.class).single();
        jdbc.sql("DELETE FROM diary_stickers WHERE category_id = ?").param(categoryId).update();
        for (Placement p : list) {
            jdbc.sql("INSERT INTO diary_stickers (category_id, slot, sticker_code, rotation) VALUES (?, ?, ?, ?)")
                    .params(categoryId, p.slot(), p.code(), p.rotation() == null ? 0 : p.rotation()).update();
        }
        return of(List.of(categoryId), memberId).getOrDefault(String.valueOf(categoryId), List.of());
    }

    /** 자리는 정해진 것 중 하나이고 겹치지 않아야 하며, 각도와 스티커 코드가 올바라야 한다 */
    private static void validatePlacements(List<Placement> list) {
        Set<String> slots = new HashSet<>();
        for (Placement p : list) {
            if (p == null || p.slot() == null || !SLOTS.contains(p.slot()) || !slots.add(p.slot())) {
                throw ApiException.field("stickers", Messages.STICKER_SLOT_INVALID);
            }
            int rotation = p.rotation() == null ? 0 : p.rotation();
            if (!ROTATIONS.contains(rotation) || p.code() == null || p.code().isBlank()) {
                throw ApiException.field("stickers", Messages.STICKER_SLOT_INVALID);
            }
        }
    }
}
