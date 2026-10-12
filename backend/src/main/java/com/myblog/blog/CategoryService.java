package com.myblog.blog;

import com.myblog.post.PostQueryService;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 분류 (CF-07, CF-08, BM-04). */
@Service
public class CategoryService {
    public record CategoryRow(long id, long blogId, String name, int sortOrder, boolean isDefault, int colorIndex) {}

    /**
     * 화면에서는 "다이어리". description = 소개, visibility = PUBLIC/SUBSCRIBERS/PRIVATE
     * (구독자만이면 블로그나 이 다이어리를 구독한 사람과 주인만, 비공개면 주인만 본다),
     * subscriberCount = 다이어리 구독자 수, subscribedByMe = 보는 사람이 이 다이어리를 구독했는지
     */
    public record CategoryView(long id, String name, String description, String visibility, long postCount,
                               boolean isDefault, int colorIndex, long subscriberCount, boolean subscribedByMe) {}

    /** 다이어리 설정. 보낸 칸만 바꾼다. */
    public record Update(String name, String description, Integer colorIndex, String visibility) {}

    private final JdbcClient jdbc;
    private final MyBlogProperties props;

    public CategoryService(JdbcClient jdbc, MyBlogProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    void createDefault(long blogId) {
        String name = props.blog().defaultCategoryName();
        jdbc.sql("""
                INSERT INTO categories (blog_id, name, name_key, sort_order, is_default, color_index)
                VALUES (?, ?, ?, 1, true, 0)""").params(blogId, name, key(name)).update();
    }

    private static String key(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    /**
     * 순서대로, 다이어리마다 글 개수 (CF-08-9). 주인은 비공개 글·비공개 다이어리까지,
     * 방문자는 공개 다이어리와 그 안의 공개 글만, 구독자는 구독자만 다이어리·글까지 본다 (글 수도 볼 수 있는 글만).
     * 다이어리마다 구독자 수와 내가 구독했는지도 함께.
     */
    public List<CategoryView> list(long blogId, boolean owner, Long viewer) {
        return jdbc.sql("SELECT c.id, c.name, c.description, c.visibility, c.is_default, c.color_index,"
                        + " (SELECT count(*) FROM posts p WHERE p.category_id = c.id AND "
                        + PostQueryService.VISIBLE_TO + ") AS post_count,"
                        + " " + SubscriptionService.DIARY_SUBSCRIBERS + " AS subscriber_count,"
                        + " EXISTS (SELECT 1 FROM diary_subscriptions ms WHERE ms.category_id = c.id"
                        + " AND ms.member_id = :viewer) AS subscribed_by_me"
                        + " FROM categories c WHERE c.blog_id = :blog AND (:owner OR c.visibility = 'PUBLIC'"
                        + " OR (c.visibility = 'SUBSCRIBERS' AND " + SubscriptionService.SUBSCRIBED_TO_DIARY + "))"
                        + " ORDER BY c.sort_order, c.id")
                .param("owner", owner).param("viewer", viewer == null ? -1L : viewer).param("blog", blogId)
                .query(CategoryView.class).list();
    }

    public CategoryRow get(long categoryId) {
        return jdbc.sql("SELECT id, blog_id, name, sort_order, is_default, color_index FROM categories WHERE id = ?")
                .param(categoryId).query(CategoryRow.class).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.CATEGORY_NOT_FOUND));
    }

    private CategoryRow requireOwned(long categoryId, long ownerBlogId) {
        CategoryRow c = get(categoryId);
        if (c.blogId() != ownerBlogId) {
            throw new ApiException(ErrorCode.CATEGORY_NOT_FOUND);
        }
        return c;
    }

    private String validName(String raw) {
        String name = Texts.trim(raw);
        if (name.isEmpty()) {
            throw ApiException.field("name", Messages.CATEGORY_NAME_REQUIRED);
        }
        if (Texts.length(name) > props.blog().categoryNameMax()) {
            throw ApiException.field("name", Messages.CATEGORY_NAME_TOO_LONG);
        }
        return name;
    }

    @Transactional
    public long add(long blogId, String rawName) {
        String name = validName(rawName);
        var next = jdbc.sql("SELECT coalesce(max(sort_order), 0) + 1, count(*) FROM categories WHERE blog_id = ?")
                .param(blogId).query((rs, i) -> new int[] {rs.getInt(1), rs.getInt(2)}).single();
        var keys = new GeneratedKeyHolder();
        try {
            jdbc.sql("""
                    INSERT INTO categories (blog_id, name, name_key, sort_order, is_default, color_index)
                    VALUES (?, ?, ?, ?, false, ?)""")
                    .params(blogId, name, key(name), next[0], next[1] % props.blog().colorCount())
                    .update(keys, "id");
        } catch (DataIntegrityViolationException e) {
            throw ApiException.withDetails(ErrorCode.CATEGORY_NAME_TAKEN, Messages.CATEGORY_NAME_TAKEN,
                    Map.of("fields", Map.of("name", Messages.CATEGORY_NAME_TAKEN)));
        }
        return keys.getKey().longValue();
    }

    @Transactional
    public void rename(long categoryId, long ownerBlogId, String rawName) {
        requireOwned(categoryId, ownerBlogId);
        String name = validName(rawName);
        try {
            jdbc.sql("UPDATE categories SET name = ?, name_key = ? WHERE id = ?")
                    .params(name, key(name), categoryId).update();
        } catch (DataIntegrityViolationException e) {
            throw ApiException.withDetails(ErrorCode.CATEGORY_NAME_TAKEN, Messages.CATEGORY_NAME_TAKEN,
                    Map.of("fields", Map.of("name", Messages.CATEGORY_NAME_TAKEN)));
        }
    }

    /** 다이어리 설정: 이름·소개·표지 색·공개 범위 중 보낸 것만 바꾼다. */
    @Transactional
    public void update(long categoryId, long ownerBlogId, Update req) {
        requireOwned(categoryId, ownerBlogId);
        if (req.name() != null) {
            rename(categoryId, ownerBlogId, req.name());
        }
        if (req.description() != null) {
            String d = Texts.trim(req.description());
            if (Texts.length(d) > props.blog().categoryDescriptionMax()) {
                throw ApiException.field("description", Messages.categoryDescriptionTooLong(props.blog().categoryDescriptionMax()));
            }
            jdbc.sql("UPDATE categories SET description = ? WHERE id = ?").params(d, categoryId).update();
        }
        if (req.colorIndex() != null) {
            if (req.colorIndex() < 0 || req.colorIndex() >= props.blog().colorCount()) {
                throw ApiException.field("colorIndex", "표지 색을 다시 골라 주세요");
            }
            jdbc.sql("UPDATE categories SET color_index = ? WHERE id = ?").params(req.colorIndex(), categoryId).update();
        }
        if (req.visibility() != null) {
            if (!List.of("PUBLIC", "SUBSCRIBERS", "PRIVATE").contains(req.visibility())) {
                throw ApiException.field("visibility", "공개 범위가 올바르지 않습니다");
            }
            jdbc.sql("UPDATE categories SET visibility = ? WHERE id = ?").params(req.visibility(), categoryId).update();
            // 비공개로 바꾸면 그 다이어리의 구독은 해제한다 (비공개 다이어리는 구독할 수 없다)
            if (req.visibility().equals("PRIVATE")) {
                jdbc.sql("DELETE FROM diary_subscriptions WHERE category_id = ?").param(categoryId).update();
            }
        }
    }

    /** 위·아래로 한 칸 옮긴다 (CF-08-5). */
    @Transactional
    public void move(long categoryId, long ownerBlogId, String direction) {
        CategoryRow c = requireOwned(categoryId, ownerBlogId);
        boolean up = "up".equals(direction);
        if (!up && !"down".equals(direction)) {
            throw ApiException.field("direction", "방향이 올바르지 않습니다");
        }
        var neighbor = jdbc.sql(up
                        ? "SELECT id, sort_order FROM categories WHERE blog_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1"
                        : "SELECT id, sort_order FROM categories WHERE blog_id = ? AND sort_order > ? ORDER BY sort_order LIMIT 1")
                .params(c.blogId(), c.sortOrder())
                .query((rs, i) -> new long[] {rs.getLong(1), rs.getLong(2)}).optional();
        neighbor.ifPresent(n -> {
            jdbc.sql("UPDATE categories SET sort_order = ? WHERE id = ?").params(n[1], c.id()).update();
            jdbc.sql("UPDATE categories SET sort_order = ? WHERE id = ?").params(c.sortOrder(), n[0]).update();
        });
    }

    /** 글이 있거나 "미분류"면 지울 수 없다 (CF-08-6, CF-08-8). */
    @Transactional
    public void delete(long categoryId, long ownerBlogId) {
        CategoryRow c = requireOwned(categoryId, ownerBlogId);
        if (c.isDefault()) {
            throw new ApiException(ErrorCode.DEFAULT_CATEGORY);
        }
        long posts = jdbc.sql("SELECT count(*) FROM posts WHERE category_id = ?").param(categoryId)
                .query(Long.class).single();
        if (posts > 0) {
            throw ApiException.withDetails(ErrorCode.CATEGORY_HAS_POSTS, Messages.categoryHasPosts(posts),
                    Map.of("postCount", posts));
        }
        jdbc.sql("DELETE FROM categories WHERE id = ?").param(categoryId).update();
    }
}
