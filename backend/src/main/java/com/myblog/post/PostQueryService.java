package com.myblog.post;

import com.myblog.common.MyBlogProperties;
import com.myblog.common.PageRequests;
import com.myblog.common.PageResponse;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.image.ImageService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * 글 조회는 모두 여기를 거친다 (헌법 II, CF-13-4).
 * 공개 범위 조건은 아래 두 개뿐이다.
 * - PUBLIC_ONLY: 홈·주제·검색·태그·이전/다음·인기 글
 * - VISIBLE_TO: 글 상세, 내 블로그 목록 (공개 글 또는 내가 쓴 글)
 * 둘 다 탈퇴 신청한 회원의 글은 뺀다(보관 기간에는 아무에게도 보이지 않는다). 탈퇴 회원은 적어서
 * members의 부분 인덱스(deleted_at)로 그 목록을 바로 찾는다.
 * 비공개 다이어리(categories.visibility = 'PRIVATE')의 글은 글이 공개여도 주인만 본다.
 */
@Service
public class PostQueryService {
    public static final String ACTIVE_AUTHOR =
            "p.author_id NOT IN (SELECT wm.id FROM members wm WHERE wm.deleted_at IS NOT NULL)";
    static final String OPEN_CATEGORY =
            "p.category_id NOT IN (SELECT pc.id FROM categories pc WHERE pc.visibility = 'PRIVATE')";
    /** 누구나 볼 수 있는 글. 다른 클래스에서도 posts 별칭 p에 붙여 쓴다. */
    public static final String PUBLIC_ONLY = "p.visibility = 'PUBLIC' AND " + OPEN_CATEGORY + " AND " + ACTIVE_AUTHOR;
    static final String VISIBLE_TO = "((p.visibility = 'PUBLIC' AND " + OPEN_CATEGORY + ") OR p.author_id = :viewer) AND "
            + ACTIVE_AUTHOR;
    /** 인기 점수: 조회 ×1 + 좋아요 ×5 + 댓글 단 사람 ×3 (글쓴이 본인 것은 빼고, 한 사람 댓글 여러 개는 한 명) */
    static final String POPULARITY = """
            (p.view_count
             + 5 * (SELECT count(*) FROM post_likes l WHERE l.post_id = p.id AND l.member_id <> p.author_id)
             + 3 * (SELECT count(DISTINCT cm.author_id) FROM comments cm
                    WHERE cm.post_id = p.id AND cm.author_id <> p.author_id))""";

    public record PostRow(long id, long blogId, String blogName, long authorId, long categoryId, String categoryName,
                          int categoryColorIndex,
                          String topicCode, String topicName, String title, String body, String visibility,
                          String coverKey, OffsetDateTime createdAt, OffsetDateTime contentUpdatedAt,
                          long viewCount, String authorNickname, long likeCount, long commentCount) {}

    private static final String SELECT = """
            SELECT p.id, p.blog_id, b.name AS blog_name, p.author_id, p.category_id, c.name AS category_name,
                   c.color_index AS category_color_index,
                   t.code AS topic_code, t.name AS topic_name, p.title, p.body, p.visibility,
                   pi.storage_key AS cover_key, p.created_at, p.content_updated_at, p.view_count,
                   am.nickname AS author_nickname,
                   (SELECT count(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
                   (SELECT count(*) FROM comments pc2 WHERE pc2.post_id = p.id) AS comment_count
            FROM posts p
            JOIN members am ON am.id = p.author_id
            JOIN blogs b ON b.id = p.blog_id
            JOIN topics t ON t.id = b.topic_id
            JOIN categories c ON c.id = p.category_id
            LEFT JOIN post_images pi ON pi.id = p.cover_image_id
            """;
    private static final String ORDER = " ORDER BY p.created_at DESC, p.id DESC";

    private final JdbcClient jdbc;
    private final MyBlogProperties props;

    public PostQueryService(JdbcClient jdbc, MyBlogProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    private static long viewerParam(Long viewer) {
        return viewer == null ? -1L : viewer;
    }

    /** 볼 수 없는 글은 없는 글과 같다: POST_NOT_FOUND (CF-09-4). */
    public PostRow requireVisible(long postId, Long viewer) {
        return jdbc.sql(SELECT + " WHERE p.id = :id AND " + VISIBLE_TO)
                .param("id", postId).param("viewer", viewerParam(viewer))
                .query(PostRow.class).optional()
                .orElseThrow(() -> new ApiException(ErrorCode.POST_NOT_FOUND));
    }

    /** 작성자만 고칠 수 있다. 남의 글은 없는 글과 같다 (CF-05-12). */
    public PostRow requireAuthor(long postId, Long me) {
        PostRow p = requireVisible(postId, me);
        if (me == null || p.authorId() != me) {
            throw new ApiException(ErrorCode.POST_NOT_FOUND);
        }
        return p;
    }

    public Map<String, Object> summary(PostRow p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id());
        m.put("blog", Map.of("id", p.blogId(), "name", p.blogName()));
        m.put("topic", Map.of("code", p.topicCode(), "name", p.topicName()));
        m.put("category", Map.of("id", p.categoryId(), "name", p.categoryName(), "colorIndex", p.categoryColorIndex()));
        m.put("title", p.title());
        m.put("excerpt", ExcerptMaker.excerpt(p.body(), props.post().excerptLength()));
        m.put("createdAt", p.createdAt());
        m.put("visibility", p.visibility());
        m.put("coverImageUrl", p.coverKey() == null ? null : ImageService.url(p.coverKey()));
        m.put("viewCount", p.viewCount());
        m.put("likeCount", p.likeCount());
        m.put("commentCount", p.commentCount());
        m.put("authorNickname", p.authorNickname());
        return m;
    }

    private PageResponse<Map<String, Object>> page(String where, Map<String, Object> params, Integer page) {
        return page(where, params, page, ORDER);
    }

    private PageResponse<Map<String, Object>> page(String where, Map<String, Object> params, Integer page,
                                                   String order) {
        int size = props.post().pageSize();
        long total = jdbc.sql("SELECT count(*) FROM posts p JOIN blogs b ON b.id = p.blog_id "
                        + "JOIN topics t ON t.id = b.topic_id JOIN categories c ON c.id = p.category_id WHERE " + where)
                .params(params).query(Long.class).single();
        return PageRequests.page(page, size, total, (limit, offset) -> {
            Map<String, Object> all = new LinkedHashMap<>(params);
            all.put("limit", limit);
            all.put("offset", offset);
            return jdbc.sql(SELECT + " WHERE " + where + order + " LIMIT :limit OFFSET :offset")
                    .params(all).query(PostRow.class).list();
        }).map(this::summary);
    }

    private List<Map<String, Object>> top(String where, Map<String, Object> params, int limit) {
        Map<String, Object> all = new LinkedHashMap<>(params);
        all.put("limit", limit);
        return jdbc.sql(SELECT + " WHERE " + where + ORDER + " LIMIT :limit").params(all)
                .query(PostRow.class).list().stream().map(this::summary).toList();
    }

    /**
     * 블로그 글 목록. 주인이 자기 블로그를 볼 때만 비공개 글·비공개 다이어리 포함 (CF-10-6).
     * 다이어리(categoryId)와 태그(tagKey)로 거를 수 있고, 최신순·인기순·오래된 순으로 정렬한다.
     */
    public PageResponse<Map<String, Object>> blogPosts(long blogId, Long categoryId, String tagKey, String sort,
                                                       Long viewer, Integer page) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("blog", blogId);
        params.put("viewer", viewerParam(viewer));
        String where = "p.blog_id = :blog AND " + VISIBLE_TO;
        if (categoryId != null) {
            where += " AND p.category_id = :category";
            params.put("category", categoryId);
        }
        if (tagKey != null && !tagKey.isBlank()) {
            where += " AND p.id IN (SELECT pt.post_id FROM post_tags pt JOIN tags g ON g.id = pt.tag_id"
                    + " WHERE g.name_key = :tag)";
            params.put("tag", tagKey);
        }
        String order = switch (sort == null ? "" : sort) {
            case "popular" -> " ORDER BY " + POPULARITY + " DESC, p.created_at DESC, p.id DESC";
            case "oldest" -> " ORDER BY p.created_at, p.id";
            default -> ORDER;
        };
        return page(where, params, page, order);
    }

    /** 대표글: 고정한 순서대로, 이 사람이 볼 수 있는 것만 (데모 개인 기능 '대표글 고정') */
    public List<Map<String, Object>> pinned(long blogId, Long viewer) {
        return jdbc.sql(SELECT + " WHERE p.blog_id = :blog AND p.pinned_at IS NOT NULL AND " + VISIBLE_TO
                        + " ORDER BY p.pinned_at, p.id")
                .param("blog", blogId).param("viewer", viewerParam(viewer))
                .query(PostRow.class).list().stream().map(this::summary).toList();
    }

    /** 블로그 왼쪽 태그 모음: 이 사람이 볼 수 있는 글에 많이 붙은 순 (데모 '블로그 태그 모음'). */
    public List<Map<String, Object>> blogTags(long blogId, Long viewer, int limit) {
        return jdbc.sql("""
                SELECT g.name, count(*) AS cnt
                FROM post_tags pt JOIN tags g ON g.id = pt.tag_id JOIN posts p ON p.id = pt.post_id
                WHERE p.blog_id = :blog AND """ + VISIBLE_TO + """
                GROUP BY g.id, g.name ORDER BY cnt DESC, g.name LIMIT :limit""")
                .param("blog", blogId).param("viewer", viewerParam(viewer)).param("limit", limit)
                .query((rs, i) -> Map.<String, Object>of("name", rs.getString("name"), "count", rs.getLong("cnt")))
                .list();
    }

    public record Neighbor(long id, String title) {}

    /** 같은 블로그의 공개 글 중 바로 앞(이전, 더 오래된)·뒤(다음, 더 새로운) 글 (CF-09-2). */
    public Map<String, Optional<Neighbor>> neighbors(PostRow p) {
        var params = Map.<String, Object>of("blog", p.blogId(), "at", p.createdAt(), "id", p.id());
        var prev = jdbc.sql("SELECT p.id, p.title FROM posts p WHERE p.blog_id = :blog AND " + PUBLIC_ONLY
                        + " AND (p.created_at, p.id) < (:at, :id) ORDER BY p.created_at DESC, p.id DESC LIMIT 1")
                .params(params).query(Neighbor.class).optional();
        var next = jdbc.sql("SELECT p.id, p.title FROM posts p WHERE p.blog_id = :blog AND " + PUBLIC_ONLY
                        + " AND (p.created_at, p.id) > (:at, :id) ORDER BY p.created_at, p.id LIMIT 1")
                .params(params).query(Neighbor.class).optional();
        return Map.of("prev", prev, "next", next);
    }

    /** 같은 블로그의 다른 공개 글 (요구사항.md 3.5). */
    public List<Map<String, Object>> otherPosts(PostRow p) {
        return top("p.blog_id = :blog AND p.id <> :id AND " + PUBLIC_ONLY,
                Map.of("blog", p.blogId(), "id", p.id()), props.post().otherPosts());
    }

    /** 태그별 공개 글 (CF-20-3). */
    public PageResponse<Map<String, Object>> tagPosts(String tagKey, Integer page) {
        return page(PUBLIC_ONLY + " AND p.id IN (SELECT pt.post_id FROM post_tags pt JOIN tags g ON g.id = pt.tag_id"
                + " WHERE g.name_key = :tag)", Map.of("tag", tagKey), page);
    }

    /**
     * 공개 글 검색: 단어마다 제목·본문·분류·블로그 이름·주제 이름 중 하나에 들어 있어야 한다(AND).
     * patterns는 이미 LIKE 이스케이프된 '%단어%' 값이다 (CF-11, 요구사항.md 3.8).
     */
    public PageResponse<Map<String, Object>> search(List<String> patterns, Integer page) {
        Map<String, Object> params = new LinkedHashMap<>();
        List<String> conds = new ArrayList<>();
        for (int i = 0; i < patterns.size(); i++) {
            String k = "w" + i;
            params.put(k, patterns.get(i));
            conds.add("(p.title ILIKE :" + k + " ESCAPE '\\' OR p.body ILIKE :" + k + " ESCAPE '\\' OR c.name ILIKE :"
                    + k + " ESCAPE '\\' OR b.name ILIKE :" + k + " ESCAPE '\\' OR t.name ILIKE :" + k + " ESCAPE '\\')");
        }
        return page(PUBLIC_ONLY + " AND " + String.join(" AND ", conds), params, page);
    }

    public List<Map<String, Object>> latestPublic(int limit) {
        return top(PUBLIC_ONLY, Map.of(), limit);
    }

    public List<Map<String, Object>> latestPublicInTopic(long topicId, int limit) {
        return top(PUBLIC_ONLY + " AND b.topic_id = :topic", Map.of("topic", topicId), limit);
    }

    public long countPublicInTopic(long topicId) {
        return jdbc.sql("SELECT count(*) FROM posts p JOIN blogs b ON b.id = p.blog_id WHERE " + PUBLIC_ONLY
                + " AND b.topic_id = :topic").param("topic", topicId).query(Long.class).single();
    }

    /** 오늘의 이슈: 대표 글을 최신순으로, 모자라면 최근 N일 조회수 많은 공개 글로 채운다 (research §12). */
    public List<Map<String, Object>> featured(int limit, OffsetDateTime popularSince) {
        List<Map<String, Object>> list = new ArrayList<>(top(PUBLIC_ONLY + " AND p.featured", Map.of(), limit));
        if (list.size() < limit) {
            List<Object> taken = list.stream().map(m -> m.get("id")).toList();
            var params = new LinkedHashMap<String, Object>();
            params.put("since", popularSince.toLocalDate());
            params.put("limit", limit - list.size());
            params.put("taken", taken.isEmpty() ? List.of(-1L) : taken);
            jdbc.sql(SELECT + " LEFT JOIN (SELECT post_id, sum(views) AS v FROM daily_stats WHERE post_id IS NOT NULL"
                            + " AND stat_date >= :since GROUP BY post_id) s ON s.post_id = p.id WHERE " + PUBLIC_ONLY
                            + " AND p.id NOT IN (:taken) ORDER BY coalesce(s.v, 0) DESC, p.created_at DESC LIMIT :limit")
                    .params(params).query(PostRow.class).list().forEach(r -> list.add(summary(r)));
        }
        return list;
    }

    /** 대시보드 인기 글: 최근 N일 조회수 많은 공개 글 (BM-02-3). */
    public List<Map<String, Object>> popularInBlog(long blogId, java.time.LocalDate since, int limit) {
        return jdbc.sql("""
                SELECT p.id, p.title, sum(s.views) AS views FROM daily_stats s JOIN posts p ON p.id = s.post_id
                WHERE s.blog_id = :blog AND s.stat_date >= :since AND\s""" + PUBLIC_ONLY + """

                GROUP BY p.id, p.title ORDER BY views DESC, p.id DESC LIMIT :limit""")
                .param("blog", blogId).param("since", since).param("limit", limit)
                .query((rs, i) -> Map.<String, Object>of("id", rs.getLong("id"), "title", rs.getString("title"),
                        "viewCount", rs.getLong("views"))).list();
    }

    /** 공지사항: 공지 담당 회원 블로그의 '공지' 다이어리에 있는 공개 글, 최신순. */
    public PageResponse<Map<String, Object>> notices(String ownerEmail, String categoryName, Integer page) {
        return page(PUBLIC_ONLY + " AND c.name = :cat AND p.author_id IN (SELECT nm.id FROM members nm"
                + " WHERE nm.email = :email)", Map.of("cat", categoryName, "email", ownerEmail), page);
    }


    /** 메인 '분야별 글': 공개 글을 주제로 거르고 최신순 또는 인기순으로 (데모 '분야별 글'). */
    public PageResponse<Map<String, Object>> publicFeed(Long topicId, String sort, Integer page) {
        Map<String, Object> params = new LinkedHashMap<>();
        String where = PUBLIC_ONLY;
        if (topicId != null) {
            where += " AND b.topic_id = :topic";
            params.put("topic", topicId);
        }
        String order = "popular".equals(sort) ? " ORDER BY " + POPULARITY + " DESC, p.created_at DESC, p.id DESC" : ORDER;
        return page(where, params, page, order);
    }

    /** 인기 글: since 이후에 올라온 공개 글을 인기 점수 순으로 (since가 null이면 전체 기간). */
    public List<Map<String, Object>> popularPublic(OffsetDateTime since, int limit) {
        Map<String, Object> params = new LinkedHashMap<>();
        String where = PUBLIC_ONLY;
        if (since != null) {
            where += " AND p.created_at >= :since";
            params.put("since", since);
        }
        params.put("limit", limit);
        return jdbc.sql(SELECT + " WHERE " + where + " ORDER BY " + POPULARITY + " DESC, p.created_at DESC, p.id DESC"
                        + " LIMIT :limit").params(params)
                .query(PostRow.class).list().stream().map(this::summary).toList();
    }

    /** 인기 다이어리: 공개 글이 있는 다이어리를 그 글들의 인기 점수 합계 순으로 (데모 '인기 다이어리'). */
    public List<Map<String, Object>> popularDiaries(int limit) {
        return jdbc.sql("SELECT c.id, c.name, c.color_index, b.id AS blog_id, b.name AS blog_name,"
                        + " count(p.id) AS post_count, sum" + POPULARITY + " AS score"
                        + " FROM categories c JOIN blogs b ON b.id = c.blog_id JOIN posts p ON p.category_id = c.id"
                        + " WHERE " + PUBLIC_ONLY
                        + " GROUP BY c.id, c.name, c.color_index, b.id, b.name"
                        + " ORDER BY score DESC, post_count DESC, c.id LIMIT :limit")
                .param("limit", limit)
                .query((rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    m.put("name", rs.getString("name"));
                    m.put("colorIndex", rs.getInt("color_index"));
                    m.put("blog", Map.of("id", rs.getLong("blog_id"), "name", rs.getString("blog_name")));
                    m.put("postCount", rs.getLong("post_count"));
                    return m;
                }).list();
    }

}
