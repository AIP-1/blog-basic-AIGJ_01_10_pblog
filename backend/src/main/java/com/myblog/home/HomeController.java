package com.myblog.home;

import com.myblog.blog.TopicService;
import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.PageResponse;
import com.myblog.common.ResponseCache;
import com.myblog.post.PostQueryService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 홈과 주제별 화면 (요구사항.md 3.2, 3.3). 공개 글만 쓴다. 커뮤니티 칸은 이번 범위에서 뺐다. */
@RestController
public class HomeController {
    private final TopicService topics;
    private final PostQueryService posts;
    private final BlogCards blogs;
    private final MyBlogProperties.Home rules;
    private final MyBlogProperties.Notice notice;
    private final KoreanClock clock;
    private final ResponseCache cache;

    public HomeController(TopicService topics, PostQueryService posts, BlogCards blogs, MyBlogProperties props,
                          KoreanClock clock, ResponseCache cache) {
        this.topics = topics;
        this.posts = posts;
        this.blogs = blogs;
        this.rules = props.home();
        this.notice = props.notice();
        this.clock = clock;
        this.cache = cache;
    }

    @GetMapping("/api/topics")
    public Object topics() {
        return cache.get("topics", rules.cacheTtl(), topics::list);
    }

    /** 누가 봐도 같은 공개 글만 담으므로 통째로 캐시한다 (ResponseCache). */
    @GetMapping("/api/home")
    public Object home() {
        return cache.get("home", rules.cacheTtl(), this::loadHome);
    }

    private Map<String, Object> loadHome() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("featured", posts.featured(rules.featured(), clock.nowOffset().minusDays(rules.popularDays())));
        m.put("latestPosts", posts.latestPublic(rules.latest()));
        m.put("blogs", blogs.recent(null, rules.blogs()));
        m.put("notices", noticePage(1).items().stream().limit(rules.notices()).toList());
        m.put("weeklyPopular", posts.popularPublic(clock.nowOffset().minusDays(rules.popularDays()), rules.weeklyPopular()));
        m.put("popularPosts", posts.popularPublic(null, rules.recommendPool()));
        m.put("popularDiaries", posts.popularDiaries(rules.popularDiaries()));
        return m;
    }

    /** 메인 '분야별 글': topic(주제 코드)이 없으면 전체, sort=popular면 인기순. */
    @GetMapping("/api/posts")
    public Object feed(@RequestParam(required = false) String topic,
                       @RequestParam(required = false) String sort,
                       @RequestParam(required = false) Integer page) {
        Long topicId = topic == null || topic.isBlank() ? null : topics.byCode(topic).id();
        String sortKey = "popular".equals(sort) ? "popular" : "latest";
        return cache.get("feed:" + (topicId == null ? "all" : topicId) + ":" + sortKey + ":" + (page == null ? 1 : page),
                rules.cacheTtl(), () -> posts.publicFeed(topicId, sort, page));
    }

    /** 공지사항: 공지 담당 회원(myblog.notice.owner-email) 블로그의 '공지' 다이어리 공개 글, 최신순. */
    @GetMapping("/api/notices")
    public PageResponse<Map<String, Object>> notices(@RequestParam(required = false) Integer page) {
        return noticePage(page);
    }

    private PageResponse<Map<String, Object>> noticePage(Integer page) {
        String email = notice.ownerEmail() == null ? "" : notice.ownerEmail().strip().toLowerCase(Locale.ROOT);
        // 담당자가 없으면 아무 회원과도 맞지 않는 값으로 찾아 빈 목록을 돌려준다
        return posts.notices(email.isEmpty() ? "-" : email, notice.categoryName(), page);
    }

    @GetMapping("/api/topics/{code}")
    public Object topic(@PathVariable String code) {
        var topic = topics.byCode(code);
        return cache.get("topic:" + topic.id(), rules.cacheTtl(), () -> loadTopic(topic));
    }

    private Map<String, Object> loadTopic(TopicService.Topic topic) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("topic", topic);
        m.put("blogCount", blogs.count(topic.id()));
        m.put("postCount", posts.countPublicInTopic(topic.id()));
        m.put("blogs", blogs.recent(topic.id(), 100));
        m.put("posts", posts.latestPublicInTopic(topic.id(), rules.topicPosts()));
        return m;
    }
}
