package com.myblog.manage;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.PageRequests;
import com.myblog.common.PageResponse;
import com.myblog.common.Texts;
import com.myblog.post.PostQueryService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 블로그 관리: 대시보드, 글 관리, 댓글 관리, 통계 (BM-02 ~ BM-06). 블로그 주인만 부른다. */
@Service
public class ManageService {
    // 컬럼·응답 이름
    private static final String TODAY = "today";
    private static final String YESTERDAY = "yesterday";
    private static final String VIEWS = "views";
    private static final String VISITORS = "visitors";
    private static final String TITLE = "title";
    private static final String CREATED_AT_COLUMN = "created_at";
    private static final String CREATED_AT = "createdAt";
    private static final String VISIBILITY = "visibility";
    private final JdbcClient jdbc;
    private final PostQueryService posts;
    private final NewCommentCounter newComments;
    private final MyBlogProperties props;
    private final KoreanClock clock;

    public ManageService(JdbcClient jdbc, PostQueryService posts, NewCommentCounter newComments,
                         MyBlogProperties props, KoreanClock clock) {
        this.jdbc = jdbc;
        this.posts = posts;
        this.newComments = newComments;
        this.props = props;
        this.clock = clock;
    }

    private Map<String, Long> totals(long blogId, String column) {
        LocalDate today = clock.today();
        return jdbc.sql("SELECT coalesce(sum(CASE WHEN stat_date = :today THEN " + column + " END), 0) AS today,"
                        + " coalesce(sum(CASE WHEN stat_date = :yesterday THEN " + column + " END), 0) AS yesterday,"
                        + " coalesce(sum(" + column + "), 0) AS total"
                        + " FROM daily_stats WHERE blog_id = :blog AND post_id IS NULL")
                .param(TODAY, today).param(YESTERDAY, today.minusDays(1)).param("blog", blogId)
                .query((rs, i) -> Map.of(TODAY, rs.getLong(TODAY), YESTERDAY, rs.getLong(YESTERDAY),
                        "total", rs.getLong("total"))).single();
    }

    /** 최근 N일 일별 조회·방문·댓글. 기록이 없는 날은 0 (BM-02-2, BM-06-2). */
    public List<Map<String, Object>> daily(long blogId, int days) {
        LocalDate today = clock.today();
        LocalDate from = today.minusDays(days - 1L);
        Map<LocalDate, long[]> byDate = new HashMap<>();
        jdbc.sql("SELECT stat_date, views, visitors FROM daily_stats WHERE blog_id = ? AND post_id IS NULL AND stat_date >= ?")
                .params(blogId, from)
                .query((rs, i) -> byDate.put(rs.getObject("stat_date", LocalDate.class),
                        new long[] {rs.getLong(VIEWS), rs.getLong(VISITORS), 0})).list();
        jdbc.sql("""
                SELECT (cm.created_at AT TIME ZONE 'Asia/Seoul')::date AS d, count(*) AS c
                FROM comments cm JOIN posts p ON p.id = cm.post_id
                WHERE p.blog_id = ? AND cm.created_at >= ? GROUP BY d""")
                .params(blogId, from.atStartOfDay(KoreanClock.SEOUL).toOffsetDateTime())
                .query((rs, i) -> byDate.computeIfAbsent(rs.getObject("d", LocalDate.class), k -> new long[3])[2]
                        = rs.getLong("c")).list();
        List<Map<String, Object>> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) {
            long[] v = byDate.getOrDefault(d, new long[3]);
            out.add(Map.of("date", d, VIEWS, v[0], VISITORS, v[1], "comments", v[2]));
        }
        return out;
    }

    public Map<String, Object> dashboard(long blogId, long ownerId) {
        var d = props.dashboard();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(VIEWS, totals(blogId, VIEWS));
        m.put(VISITORS, totals(blogId, VISITORS));
        m.put("newCommentCount", newComments.count(blogId, ownerId));
        m.put("daily", daily(blogId, d.chartDays()));
        m.put("popularPosts", posts.popularInBlog(blogId, clock.today().minusDays(d.popularDays() - 1L), d.popularSize()));
        m.put("recentPosts", jdbc.sql("""
                SELECT id, title, created_at, visibility FROM posts WHERE blog_id = ?
                ORDER BY created_at DESC, id DESC LIMIT ?""").params(blogId, d.recentSize())
                .query((rs, i) -> Map.of("id", rs.getLong("id"), TITLE, rs.getString(TITLE),
                        CREATED_AT, rs.getObject(CREATED_AT_COLUMN, OffsetDateTime.class),
                        VISIBILITY, rs.getString(VISIBILITY))).list());
        return m;
    }

    /** 비공개를 포함한 내 글 전체, 공개 여부·분류로 거르기 (BM-03). */
    public PageResponse<Map<String, Object>> posts(long blogId, String visibility, Long categoryId, Integer page) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("blog", blogId);
        String where = "p.blog_id = :blog";
        if (visibility != null && List.of("PUBLIC", "SUBSCRIBERS", "PRIVATE").contains(visibility)) {
            where += " AND p.visibility = :vis";
            params.put("vis", visibility);
        }
        if (categoryId != null) {
            where += " AND p.category_id = :cat";
            params.put("cat", categoryId);
        }
        long total = jdbc.sql("SELECT count(*) FROM posts p WHERE " + where).params(params).query(Long.class).single();
        String finalWhere = where;
        return PageRequests.page(page, props.post().pageSize(), total, (limit, offset) -> {
            Map<String, Object> all = new LinkedHashMap<>(params);
            all.put("limit", limit);
            all.put("offset", offset);
            return jdbc.sql("""
                    SELECT p.id, p.title, c.id AS category_id, c.name AS category_name, p.created_at, p.visibility,
                           p.view_count, (SELECT count(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
                    FROM posts p JOIN categories c ON c.id = p.category_id WHERE\s""" + finalWhere + """

                    ORDER BY p.created_at DESC, p.id DESC LIMIT :limit OFFSET :offset""")
                    .params(all).query((rs, i) -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id", rs.getLong("id"));
                        m.put(TITLE, rs.getString(TITLE));
                        m.put("category", Map.of("id", rs.getLong("category_id"), "name", rs.getString("category_name")));
                        m.put(CREATED_AT, rs.getObject(CREATED_AT_COLUMN, OffsetDateTime.class));
                        m.put(VISIBILITY, rs.getString(VISIBILITY));
                        m.put("viewCount", rs.getLong("view_count"));
                        m.put("commentCount", rs.getLong("comment_count"));
                        return m;
                    }).list();
        });
    }

    /** 내 블로그 글의 모든 댓글, 최신순. 열면 새 댓글이 모두 읽음이 된다 (BM-05-1, 2, 6). */
    @Transactional
    public PageResponse<Map<String, Object>> comments(long blogId, long ownerId, Integer page) {
        OffsetDateTime seenAt = jdbc.sql("SELECT comments_seen_at FROM blogs WHERE id = ?").param(blogId)
                .query(OffsetDateTime.class).single();
        long total = jdbc.sql("SELECT count(*) FROM comments cm JOIN posts p ON p.id = cm.post_id WHERE p.blog_id = ?")
                .param(blogId).query(Long.class).single();
        int preview = props.comment().previewLength();
        var result = PageRequests.page(page, props.post().pageSize(), total, (limit, offset) -> jdbc.sql("""
                SELECT cm.id, cm.parent_id, CASE WHEN m.deleted_at IS NULL THEN cm.author_id END AS author_id, m.nickname, cm.body, cm.created_at, p.id AS post_id, p.title
                FROM comments cm JOIN posts p ON p.id = cm.post_id LEFT JOIN members m ON m.id = cm.author_id
                WHERE p.blog_id = ? ORDER BY cm.created_at DESC, cm.id DESC LIMIT ? OFFSET ?""")
                .params(blogId, limit, offset).query((rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    long authorId = rs.getLong("author_id");
                    boolean deleted = rs.wasNull();
                    OffsetDateTime at = rs.getObject(CREATED_AT_COLUMN, OffsetDateTime.class);
                    m.put("id", rs.getLong("id"));
                    m.put("author", deleted ? null : Map.of("id", authorId, "nickname", rs.getString("nickname")));
                    m.put(CREATED_AT, at);
                    m.put("preview", Texts.cut(rs.getString("body").replaceAll("\\s+", " "), preview));
                    m.put("post", Map.of("id", rs.getLong("post_id"), TITLE, rs.getString(TITLE)));
                    m.put("reply", rs.getObject("parent_id") != null);
                    m.put("isNew", at.isAfter(seenAt) && (deleted || authorId != ownerId));
                    return m;
                }).list());
        jdbc.sql("UPDATE blogs SET comments_seen_at = ? WHERE id = ?").params(clock.nowOffset(), blogId).update();
        return result;
    }
}
