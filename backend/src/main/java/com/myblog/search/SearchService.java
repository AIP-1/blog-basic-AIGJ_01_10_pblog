package com.myblog.search;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.PageRequests;
import com.myblog.common.PageResponse;
import com.myblog.home.BlogCards;
import com.myblog.post.PostQueryService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** 통합 검색: 블로그와 공개 글 (요구사항.md 3.8, CF-11). 커뮤니티는 이번 범위에서 뺐다. */
@Service
public class SearchService {
    private final JdbcClient jdbc;
    private final PostQueryService posts;
    private final BlogCards blogCards;
    private final MyBlogProperties props;
    private final KoreanClock clock;

    public SearchService(JdbcClient jdbc, PostQueryService posts, BlogCards blogCards, MyBlogProperties props,
                         KoreanClock clock) {
        this.jdbc = jdbc;
        this.posts = posts;
        this.blogCards = blogCards;
        this.props = props;
        this.clock = clock;
    }

    public Map<String, Object> search(String raw, String type, Integer page) {
        KeywordQuery q = KeywordQuery.parse(raw, props.search().minLength(), props.search().maxLength());
        jdbc.sql("INSERT INTO search_logs (keyword, searched_at) VALUES (?, ?)")
                .params(q.normalized(), clock.nowOffset()).update();
        String t = type == null ? "all" : type;
        boolean all = t.equals("all");
        PageResponse<Map<String, Object>> blogs = all || t.equals("blog") ? blogs(q, pageFor(all, page)) : empty();
        PageResponse<Map<String, Object>> found = all || t.equals("post")
                ? posts.search(q.patterns(), pageFor(all, page)) : empty();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("query", q.normalized());
        m.put("type", t);
        m.put("total", blogs.totalItems() + found.totalItems());
        m.put("blogs", blogs);
        m.put("posts", found);
        return m;
    }

    /** 전체 검색은 블로그·글 모두 첫 쪽만 보여 준다. */
    private static int pageFor(boolean all, Integer page) {
        return all ? 1 : page;
    }

    private static PageResponse<Map<String, Object>> empty() {
        return new PageResponse<>(List.of(), 1, 0, 0, 0);
    }

    /** 블로그: 이름·주인 닉네임·소개·주제·분류 이름. */
    private PageResponse<Map<String, Object>> blogs(KeywordQuery q, Integer page) {
        Map<String, Object> params = new LinkedHashMap<>();
        List<String> conds = new ArrayList<>();
        for (int i = 0; i < q.patterns().size(); i++) {
            String k = "w" + i;
            params.put(k, q.patterns().get(i));
            conds.add("(b.name ILIKE :" + k + " ESCAPE '\\' OR m.nickname ILIKE :" + k + " ESCAPE '\\' OR b.description ILIKE :"
                    + k + " ESCAPE '\\' OR t.name ILIKE :" + k + " ESCAPE '\\' OR EXISTS (SELECT 1 FROM categories c WHERE c.blog_id = b.id AND c.name ILIKE :"
                    + k + " ESCAPE '\\'))");
        }
        String from = " FROM blogs b JOIN members m ON m.id = b.owner_id JOIN topics t ON t.id = b.topic_id"
                + " WHERE m.deleted_at IS NULL AND " + String.join(" AND ", conds);
        long total = jdbc.sql("SELECT count(*)" + from).params(params).query(Long.class).single();
        int size = props.post().pageSize();
        return PageRequests.page(page, size, total, (limit, offset) -> {
            Map<String, Object> all = new LinkedHashMap<>(params);
            all.put("limit", limit);
            all.put("offset", offset);
            List<Long> ids = jdbc.sql("SELECT b.id" + from + " ORDER BY b.id DESC LIMIT :limit OFFSET :offset")
                    .params(all).query(Long.class).list();
            return blogCards.cards(ids);
        });
    }

    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Seoul")
    public void purgeOldLogs() {
        jdbc.sql("DELETE FROM search_logs WHERE searched_at < ?")
                .param(clock.nowOffset().minus(props.search().logRetention())).update();
    }
}
