package com.myblog.post;

import com.myblog.common.KoreanClock;
import com.myblog.common.Texts;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import com.myblog.common.error.Messages;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 책갈피와 책갈피 폴더 (데모 '저장(스크랩) + 폴더 분류').
 * 회원이 글을 폴더별로 꽂아 두고 '책갈피'에서 다시 본다. folder_id가 비어 있으면 미분류.
 * 볼 수 있는 글이면 내 글도 꽂을 수 있고, 개수는 지금 볼 수 있는 글만 센다.
 */
@Service
public class BookmarkService {
    /** 폴더 이름 최대 글자 수 (데모 LIMITS.folder) */
    public static final int FOLDER_NAME_MAX = 20;
    /** 탭 이름과 겹쳐서 폴더 이름으로 쓸 수 없다 */
    private static final Set<String> RESERVED = Set.of("미분류", "전체");
    /** 지금 볼 수 있는 글의 책갈피만 (bm 별칭) */
    private static final String VISIBLE_BOOKMARK = "bm.member_id = :me AND bm.post_id IN (SELECT p.id FROM posts p WHERE "
            + PostQueryService.VISIBLE_TO.replace(":viewer", ":me") + ")";

    public record Folder(long id, String name, OffsetDateTime createdAt, long count) {}

    private final JdbcClient jdbc;
    private final PostQueryService queries;
    private final KoreanClock clock;

    public BookmarkService(JdbcClient jdbc, PostQueryService queries, KoreanClock clock) {
        this.jdbc = jdbc;
        this.queries = queries;
        this.clock = clock;
    }

    /** 이 글의 내 책갈피: 꽂지 않았으면 null, 꽂았으면 폴더 (미분류면 folderId null) */
    public Map<String, Object> of(long postId, Long memberId) {
        if (memberId == null) {
            return null;
        }
        return jdbc.sql("""
                        SELECT bm.folder_id, f.name FROM bookmarks bm LEFT JOIN bookmark_folders f ON f.id = bm.folder_id
                        WHERE bm.post_id = ? AND bm.member_id = ?""")
                .params(postId, memberId)
                .query((rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    long folderId = rs.getLong("folder_id");
                    m.put("folderId", rs.wasNull() ? null : folderId);
                    m.put("folderName", rs.getString("name"));
                    return m;
                }).optional().orElse(null);
    }

    /** 꽂거나, 이미 꽂은 글이면 폴더만 옮긴다. folderId가 null이면 미분류. */
    @Transactional
    public Map<String, Object> save(long postId, long memberId, Long folderId) {
        queries.requireVisible(postId, memberId);
        if (folderId != null) {
            requireFolder(folderId, memberId);
        }
        jdbc.sql("""
                        INSERT INTO bookmarks (member_id, post_id, folder_id, created_at) VALUES (?, ?, ?, ?)
                        ON CONFLICT (member_id, post_id) DO UPDATE SET folder_id = EXCLUDED.folder_id""")
                .params(memberId, postId, folderId, clock.nowOffset()).update();
        return of(postId, memberId);
    }

    /** 책갈피 빼기. 없어도 그대로 성공. */
    @Transactional
    public void remove(long postId, long memberId) {
        jdbc.sql("DELETE FROM bookmarks WHERE post_id = ? AND member_id = ?").params(postId, memberId).update();
    }

    /** 폴더 탭: 전체 · 미분류 개수와 만든 순서대로 폴더마다 개수 */
    public Map<String, Object> folders(long memberId) {
        var counts = jdbc.sql("SELECT count(*) AS total, count(*) FILTER (WHERE bm.folder_id IS NULL) AS none"
                        + " FROM bookmarks bm WHERE " + VISIBLE_BOOKMARK)
                .param("me", memberId)
                .query((rs, i) -> new long[] {rs.getLong("total"), rs.getLong("none")}).single();
        List<Folder> folders = jdbc.sql("SELECT f.id, f.name, f.created_at,"
                        + " (SELECT count(*) FROM bookmarks bm WHERE bm.folder_id = f.id AND " + VISIBLE_BOOKMARK + ") AS count"
                        + " FROM bookmark_folders f WHERE f.member_id = :me ORDER BY f.created_at, f.id")
                .param("me", memberId).query(Folder.class).list();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", counts[0]);
        m.put("none", counts[1]);
        m.put("folders", folders);
        return m;
    }

    @Transactional
    public Folder createFolder(long memberId, String rawName) {
        String name = validName(rawName);
        OffsetDateTime now = clock.nowOffset();
        var keys = new GeneratedKeyHolder();
        try {
            jdbc.sql("INSERT INTO bookmark_folders (member_id, name, created_at) VALUES (?, ?, ?)")
                    .params(memberId, name, now).update(keys, "id");
        } catch (DuplicateKeyException e) {
            throw nameTaken();
        }
        return new Folder(keys.getKey().longValue(), name, now, 0);
    }

    @Transactional
    public void renameFolder(long folderId, long memberId, String rawName) {
        requireFolder(folderId, memberId);
        String name = validName(rawName);
        try {
            jdbc.sql("UPDATE bookmark_folders SET name = ? WHERE id = ?").params(name, folderId).update();
        } catch (DuplicateKeyException e) {
            throw nameTaken();
        }
    }

    /** 폴더를 지우면 안의 책갈피는 미분류로 (FK ON DELETE SET NULL). 글은 지우지 않는다. */
    @Transactional
    public void deleteFolder(long folderId, long memberId) {
        requireFolder(folderId, memberId);
        jdbc.sql("DELETE FROM bookmark_folders WHERE id = ?").param(folderId).update();
    }

    /** 남의 폴더는 없는 폴더와 같다. */
    void requireFolder(long folderId, long memberId) {
        boolean mine = jdbc.sql("SELECT count(*) FROM bookmark_folders WHERE id = ? AND member_id = ?")
                .params(folderId, memberId).query(Long.class).single() > 0;
        if (!mine) {
            throw new ApiException(ErrorCode.BOOKMARK_FOLDER_NOT_FOUND);
        }
    }

    private static String validName(String raw) {
        String name = Texts.trim(raw);
        if (name.isEmpty()) {
            throw ApiException.field("name", Messages.BOOKMARK_FOLDER_NAME_REQUIRED);
        }
        if (RESERVED.contains(name)) {
            throw ApiException.field("name", Messages.BOOKMARK_FOLDER_NAME_RESERVED);
        }
        if (Texts.length(name) > FOLDER_NAME_MAX) {
            throw ApiException.field("name", Messages.BOOKMARK_FOLDER_NAME_TOO_LONG);
        }
        return name;
    }

    private static ApiException nameTaken() {
        return new ApiException(ErrorCode.BOOKMARK_FOLDER_NAME_TAKEN, Messages.BOOKMARK_FOLDER_NAME_TAKEN,
                Map.of("name", Messages.BOOKMARK_FOLDER_NAME_TAKEN), Map.of());
    }
}
