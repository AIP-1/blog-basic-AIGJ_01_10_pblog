package com.myblog.post;

import com.myblog.common.Texts;
import java.util.regex.Pattern;

/** 목록의 본문 앞부분: 마크다운 기호를 걷어 내고 줄바꿈을 공백으로, 최대 N자 + "…" (CF-10-5). */
public final class ExcerptMaker {
    private static final Pattern CODE_FENCE = Pattern.compile("```[^\\n]*");
    private static final Pattern IMAGE = Pattern.compile("!\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern LINE_PREFIX = Pattern.compile("(?m)^\\s{0,3}(#{1,6}\\s+|>\\s?|[-*+]\\s+|\\d+\\.\\s+)");
    private static final Pattern EMPHASIS = Pattern.compile("(\\*\\*|__|\\*|_|~~|`)");
    private static final Pattern RULE = Pattern.compile("(?m)^[ \\t]*+(?:[-*_][ \\t]*+){3,}+$");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern FIRST_IMAGE = Pattern.compile("!\\[[^\\]]*]\\((/api/images/[^)\\s]+|https?://[^)\\s]+)\\)");

    private ExcerptMaker() {}

    public static String plain(String markdown) {
        String s = markdown == null ? "" : markdown;
        s = CODE_FENCE.matcher(s).replaceAll(" ");
        s = IMAGE.matcher(s).replaceAll("$1");
        s = LINK.matcher(s).replaceAll("$1");
        s = RULE.matcher(s).replaceAll(" ");
        s = LINE_PREFIX.matcher(s).replaceAll("");
        s = EMPHASIS.matcher(s).replaceAll("");
        return SPACES.matcher(s).replaceAll(" ").strip();
    }

    public static String excerpt(String markdown, int max) {
        return Texts.cut(plain(markdown), max);
    }

    /** 대표 사진을 안 골랐을 때 목록 미리보기로 쓸 본문의 첫 사진 주소. 없으면 null */
    public static String firstImage(String markdown) {
        if (markdown == null) {
            return null;
        }
        var m = FIRST_IMAGE.matcher(markdown);
        return m.find() ? m.group(1) : null;
    }
}
