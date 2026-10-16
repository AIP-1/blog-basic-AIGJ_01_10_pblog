package com.myblog.image;

import com.myblog.common.KoreanClock;
import com.myblog.common.MyBlogProperties;
import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/** 글 이미지 (CF-22, research §5). */
@Service
public class ImageService {
    private static final Logger log = LoggerFactory.getLogger(ImageService.class);
    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyy/MM");

    public record Uploaded(long id, String url) {}

    /** 사진 파일 내용. 배열은 기본 equals가 주소를 비교하므로 내용으로 비교하게 바꾼다. */
    public record Image(byte[] bytes, String contentType) {
        @Override
        public boolean equals(Object o) {
            return o instanceof Image other && Arrays.equals(bytes, other.bytes)
                    && Objects.equals(contentType, other.contentType);
        }

        @Override
        public int hashCode() {
            return 31 * Arrays.hashCode(bytes) + Objects.hashCode(contentType);
        }

        @Override
        public String toString() {
            return "Image[" + (bytes == null ? 0 : bytes.length) + " bytes, " + contentType + "]";
        }
    }

    private final ImageStorage storage;
    private final JdbcClient jdbc;
    private final MyBlogProperties.Image rules;
    private final KoreanClock clock;

    public ImageService(ImageStorage storage, JdbcClient jdbc, MyBlogProperties props, KoreanClock clock) {
        this.storage = storage;
        this.jdbc = jdbc;
        this.rules = props.image();
        this.clock = clock;
    }

    public static String url(String key) {
        return "/api/images/" + key;
    }

    /** 형식은 확장자가 아니라 파일 앞부분(매직 넘버)으로 판별한다. */
    static Optional<String[]> detect(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Optional.of(new String[] {"image/jpeg", "jpg"});
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return Optional.of(new String[] {"image/png", "png"});
        }
        if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') {
            return Optional.of(new String[] {"image/gif", "gif"});
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return Optional.of(new String[] {"image/webp", "webp"});
        }
        return Optional.empty();
    }

    public Uploaded upload(long memberId, MultipartFile file) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INVALID_IMAGE);
        }
        if (bytes.length == 0 || bytes.length > rules.maxBytes()) {
            throw new ApiException(ErrorCode.INVALID_IMAGE);
        }
        String[] type = detect(bytes).orElseThrow(() -> new ApiException(ErrorCode.INVALID_IMAGE));
        String key = "posts/" + clock.today().format(YM) + "/" + UUID.randomUUID() + "." + type[1];
        storage.put(key, bytes, type[0]);
        var keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO post_images (uploader_id, storage_key, content_type, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?)""").params(memberId, key, type[0], bytes.length, clock.nowOffset())
                .update(keys, "id");
        return new Uploaded(keys.getKey().longValue(), url(key));
    }

    public Image read(String key) {
        String type = jdbc.sql("SELECT content_type FROM post_images WHERE storage_key = ?").param(key)
                .query(String.class).optional().orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
        byte[] bytes = storage.get(key).orElseThrow(() -> new ApiException(ErrorCode.IMAGE_NOT_FOUND));
        return new Image(bytes, type);
    }

    /**
     * 글 저장 시 본문에 쓴 이미지(내가 올린 것)를 그 글에 연결한다. 본문에서 빠진 이미지는 연결을 풀고,
     * 연결 후 글당 10장을 넘으면 거절한다 (CF-22-3).
     */
    public void attach(long postId, long memberId, Collection<Long> imageIds) {
        List<Long> ids = imageIds == null ? List.of() : imageIds.stream().distinct().toList();
        if (ids.size() > rules.maxPerPost()) {
            throw new ApiException(ErrorCode.TOO_MANY_IMAGES);
        }
        jdbc.sql("UPDATE post_images SET post_id = NULL WHERE post_id = ?").param(postId).update();
        if (!ids.isEmpty()) {
            jdbc.sql("UPDATE post_images SET post_id = :post WHERE id IN (:ids) AND uploader_id = :member")
                    .param("post", postId).param("ids", ids).param("member", memberId).update();
        }
    }

    public boolean ownedBy(long imageId, long memberId) {
        return jdbc.sql("SELECT count(*) FROM post_images WHERE id = ? AND uploader_id = ?")
                .params(imageId, memberId).query(Long.class).single() > 0;
    }

    public List<String> keysOfPost(long postId) {
        return jdbc.sql("SELECT storage_key FROM post_images WHERE post_id = ?").param(postId).query(String.class).list();
    }

    /** DB 변경이 확정된 뒤에만 파일을 지운다. */
    public void deleteFilesAfterCommit(List<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        Runnable task = () -> keys.forEach(k -> {
            try {
                storage.delete(k);
            } catch (RuntimeException e) {
                log.warn("Image delete failed {}: {}", k, e.getMessage());
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    /** 올렸지만 글에 연결되지 않은 이미지는 24시간 뒤 지운다. 임시저장 글이 쓰고 있는 이미지는 남긴다. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    public void cleanOrphans() {
        var cutoff = clock.nowOffset().minus(rules.orphanTtl());
        List<Map<String, Object>> rows = jdbc.sql("""
                SELECT id, storage_key FROM post_images
                WHERE post_id IS NULL AND created_at < ?
                  AND id NOT IN (SELECT cover_image_id FROM posts WHERE cover_image_id IS NOT NULL)
                  AND NOT EXISTS (SELECT 1 FROM drafts d WHERE post_images.id = ANY (d.image_ids))""")
                .param(cutoff).query().listOfRows();
        for (var row : rows) {
            jdbc.sql("DELETE FROM post_images WHERE id = ?").param(row.get("id")).update();
            deleteFilesAfterCommit(List.of((String) row.get("storage_key")));
        }
    }
}
