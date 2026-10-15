package com.myblog.post;

import com.myblog.common.MyBlogProperties;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** 태그 (CF-20). */
@Service
public class TagService {
    /** 태그에 쓸 수 없는 글자 (공백, 쉼표) */
    private static final Pattern FORBIDDEN = Pattern.compile("[\\s,]");
    private final JdbcClient jdbc;
    private final MyBlogProperties.Tag rules;

    public TagService(JdbcClient jdbc, MyBlogProperties props) {
        this.jdbc = jdbc;
        this.rules = props.tag();
    }

    public static String key(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    /** 앞의 #은 지우고, 공백·쉼표 불가, 1~15자, 대소문자 무시 중복 제거, 최대 5개. */
    public List<String> normalize(List<String> raw) {
        var byKey = new LinkedHashMap<String, String>();
        for (String r : raw == null ? List.<String>of() : raw) {
            String name = Texts.trim(r).replaceFirst("^#+", "");
            if (name.isEmpty()) {
                continue;
            }
            if (Texts.length(name) > rules.maxLength() || FORBIDDEN.matcher(name).find()) {
                throw ApiException.field("tags", Messages.TAG_RULE);
            }
            byKey.putIfAbsent(key(name), name);
        }
        if (byKey.size() > rules.maxPerPost()) {
            throw new ApiException(ErrorCode.TOO_MANY_TAGS);
        }
        return new ArrayList<>(byKey.values());
    }

    public void replace(long postId, List<String> names) {
        jdbc.sql("DELETE FROM post_tags WHERE post_id = ?").param(postId).update();
        for (String name : names) {
            jdbc.sql("INSERT INTO tags (name, name_key) VALUES (?, ?) ON CONFLICT (name_key) DO NOTHING")
                    .params(name, key(name)).update();
            jdbc.sql("INSERT INTO post_tags (post_id, tag_id) SELECT ?, id FROM tags WHERE name_key = ?")
                    .params(postId, key(name)).update();
        }
    }

    public List<String> tagsOf(long postId) {
        return jdbc.sql("""
                SELECT g.name FROM post_tags pt JOIN tags g ON g.id = pt.tag_id
                WHERE pt.post_id = ? ORDER BY g.name""").param(postId).query(String.class).list();
    }
}
