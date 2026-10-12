package com.myblog.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.myblog.common.error.ApiException;
import com.myblog.search.KeywordQuery;
import org.junit.jupiter.api.Test;

class TextRulesTest {

    @Test
    void CF_10_5_excerptStripsMarkdownAndNewlines() {
        String md = "# 제목\n\n**굵게** 그리고 [링크](http://a.b) ![사진](/api/images/x.png)\n- 목록\n> 인용";
        assertThat(ExcerptMaker.plain(md)).isEqualTo("제목 굵게 그리고 링크 사진 목록 인용");
        assertThat(ExcerptMaker.excerpt("가".repeat(150), 100)).hasSize(101).endsWith("…");
        assertThat(ExcerptMaker.excerpt("짧은 글", 100)).isEqualTo("짧은 글");
    }

    @Test
    void listPreviewFallsBackToFirstPhotoInBody() {
        assertThat(ExcerptMaker.firstImage("글\n![](/api/images/a.png)\n![](/api/images/b.png)")).isEqualTo("/api/images/a.png");
        assertThat(ExcerptMaker.firstImage("사진 없는 글 [링크](https://x.com)")).isNull();
        assertThat(ExcerptMaker.firstImage(null)).isNull();
    }

    @Test
    void CF_11_1_queryLength() {
        assertThatThrownBy(() -> KeywordQuery.parse(" 단 ", 2, 50)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> KeywordQuery.parse("   ", 2, 50)).isInstanceOf(ApiException.class);
        assertThat(KeywordQuery.parse("  단풍   명소 ", 2, 50).normalized()).isEqualTo("단풍 명소");
    }

    @Test
    void CF_11_9_specialCharactersEscaped() {
        var q = KeywordQuery.parse("100% a_b c\\d", 2, 50);
        assertThat(q.patterns()).containsExactly("%100\\%%", "%a\\_b%", "%c\\\\d%");
    }
}
