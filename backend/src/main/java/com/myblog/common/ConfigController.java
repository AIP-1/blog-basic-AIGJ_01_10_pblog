package com.myblog.common;

import com.myblog.blog.TopicService;
import com.myblog.post.BookmarkService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 화면이 쓸 기본값을 내려 준다 (FR-039, NF-08). */
@RestController
public class ConfigController {
    private final MyBlogProperties props;
    private final TopicService topics;

    public ConfigController(MyBlogProperties props, TopicService topics) {
        this.props = props;
        this.topics = topics;
    }

    @GetMapping("/api/config")
    public Map<String, Object> config() {
        Map<String, Object> limits = new LinkedHashMap<>();
        limits.put("nicknameMin", props.member().nicknameMin());
        limits.put("nicknameMax", props.member().nicknameMax());
        limits.put("passwordMin", props.member().passwordMin());
        limits.put("passwordMax", props.member().passwordMax());
        limits.put("bioMax", props.member().bioMax());
        limits.put("blogNameMax", props.blog().nameMax());
        limits.put("blogDescriptionMax", props.blog().descriptionMax());
        limits.put("blogAboutMax", props.blog().aboutMax());
        limits.put("postTitleMax", props.post().titleMax());
        limits.put("postBodyMax", props.post().bodyMax());
        limits.put("categoryNameMax", props.blog().categoryNameMax());
        limits.put("categoryDescriptionMax", props.blog().categoryDescriptionMax());
        limits.put("commentMax", props.comment().bodyMax());
        limits.put("tagsPerPost", props.tag().maxPerPost());
        limits.put("tagMax", props.tag().maxLength());
        limits.put("reportDetailMax", props.report().detailMax());
        limits.put("imageMaxBytes", props.image().maxBytes());
        limits.put("imagesPerPost", props.image().maxPerPost());
        limits.put("searchMin", props.search().minLength());
        limits.put("searchMax", props.search().maxLength());
        limits.put("withdrawKeepDays", props.member().withdrawKeep().toDays());
        limits.put("bookmarkFolderNameMax", BookmarkService.FOLDER_NAME_MAX);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("limits", limits);
        m.put("pageSize", props.post().pageSize());
        m.put("trendingIntervalSeconds", props.trending().interval().toSeconds());
        m.put("draftLimit", props.draft().maxPerMember());
        m.put("draftAutosaveSeconds", props.draft().autosaveInterval().toSeconds());
        m.put("topics", topics.list());
        return m;
    }
}
