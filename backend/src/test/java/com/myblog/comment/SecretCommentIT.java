package com.myblog.comment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.myblog.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

/** 비밀 댓글: 쓴 사람 · 블로그 주인 · 원 댓글을 쓴 사람만 내용을 보고, 비밀 댓글의 답글은 늘 비밀이다. */
class SecretCommentIT extends IntegrationTest {
    private MockHttpSession owner;
    private MockHttpSession writer;
    private MockHttpSession other;
    private String url;

    @BeforeEach
    void setUp() throws Exception {
        owner = member("주인", "owner@example.com");
        writer = member("글쓴이", "writer@example.com");
        other = member("구경꾼", "other@example.com");
        url = "/api/posts/" + writePost(owner, "비밀 댓글 글", "본문", "PUBLIC") + "/comments";
    }

    private long comment(MockHttpSession s, Map<String, Object> body) throws Exception {
        long id = read(mvc.perform(postJson(url, body).session(s)).andExpect(status().isCreated()).andReturn())
                .get("id").asLong();
        redis.delete(redis.keys("comment:cooldown:*"));
        return id;
    }

    @Test
    void onlyWriterAndOwnerReadSecretComment() throws Exception {
        comment(writer, Map.of("body", "주인만 보세요", "secret", true));

        for (MockHttpSession s : new MockHttpSession[] {writer, owner}) {
            mvc.perform(get(url).session(s))
                    .andExpect(jsonPath("$[0].secret").value(true))
                    .andExpect(jsonPath("$[0].hidden").value(false))
                    .andExpect(jsonPath("$[0].body").value("주인만 보세요"))
                    .andExpect(jsonPath("$[0].author.nickname").value("글쓴이"));
        }
        // 손님과 다른 회원에게는 내용 · 작성자를 보내지 않는다
        for (MockHttpSession s : new MockHttpSession[] {other, new MockHttpSession()}) {
            mvc.perform(get(url).session(s))
                    .andExpect(jsonPath("$[0].secret").value(true))
                    .andExpect(jsonPath("$[0].hidden").value(true))
                    .andExpect(jsonPath("$[0].body").doesNotExist())
                    .andExpect(jsonPath("$[0].author").doesNotExist())
                    .andExpect(jsonPath("$[0].canDelete").value(false));
        }
        // 블로그 관리의 댓글 목록에서 주인은 비밀 표시와 내용을 함께 본다
        mvc.perform(get("/api/manage/comments").session(owner))
                .andExpect(jsonPath("$.items[0].secret").value(true))
                .andExpect(jsonPath("$.items[0].preview").value("주인만 보세요"));
    }

    @Test
    void publicByDefaultAndWithFalse() throws Exception {
        comment(writer, Map.of("body", "그냥 댓글"));
        comment(other, Map.of("body", "공개라고 적은 댓글", "secret", false));
        mvc.perform(get(url))
                .andExpect(jsonPath("$[0].secret").value(false))
                .andExpect(jsonPath("$[0].hidden").value(false))
                .andExpect(jsonPath("$[0].body").value("그냥 댓글"))
                .andExpect(jsonPath("$[1].secret").value(false));
    }

    @Test
    void replyToSecretIsSecretAndReadableByParentWriter() throws Exception {
        long root = comment(writer, Map.of("body", "비밀 질문", "secret", true));
        // 비밀로 고르지 않아도 비밀 댓글의 답글은 비밀이 된다
        mvc.perform(postJson(url, Map.of("body", "주인의 답", "parentId", root)).session(owner))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.secret").value(true));

        mvc.perform(get(url).session(writer))
                .andExpect(jsonPath("$[0].replies[0].hidden").value(false))
                .andExpect(jsonPath("$[0].replies[0].body").value("주인의 답"));
        mvc.perform(get(url).session(other))
                .andExpect(jsonPath("$[0].replies[0].secret").value(true))
                .andExpect(jsonPath("$[0].replies[0].hidden").value(true))
                .andExpect(jsonPath("$[0].replies[0].body").doesNotExist());
    }

    @Test
    void cannotReplyToSecretCommentYouCannotRead() throws Exception {
        long root = comment(writer, Map.of("body", "비밀 질문", "secret", true));
        mvc.perform(postJson(url, Map.of("body", "엿보기", "parentId", root)).session(other))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.parentId").value("답글을 달 댓글을 찾을 수 없습니다"));
    }

    @Test
    void secretReplyOnPublicCommentIsReadByParentWriterOnly() throws Exception {
        long root = comment(other, Map.of("body", "공개 질문"));
        comment(owner, Map.of("body", "따로 하는 답", "parentId", root, "secret", true));

        mvc.perform(get(url).session(other)).andExpect(jsonPath("$[0].replies[0].body").value("따로 하는 답"));
        mvc.perform(get(url).session(writer))
                .andExpect(jsonPath("$[0].body").value("공개 질문"))
                .andExpect(jsonPath("$[0].replies[0].hidden").value(true));
    }
}
