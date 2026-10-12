package com.myblog.blog;

import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** 주제 목록 (요구사항.md 1장). topic 표의 시드만 고치면 늘리거나 줄일 수 있다. */
@Service
public class TopicService {
    public record Topic(long id, String code, String name, String description) {}

    private final JdbcClient jdbc;

    public TopicService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Topic> list() {
        return jdbc.sql("SELECT id, code, name, description FROM topics ORDER BY sort_order")
                .query(Topic.class).list();
    }

    /** 글쓰기 분야: 코드로 찾는다. 없는 코드면 비어 있다. */
    public Optional<Long> idOf(String code) {
        return code == null ? Optional.empty()
                : jdbc.sql("SELECT id FROM topics WHERE code = ?").param(code).query(Long.class).optional();
    }

    public Topic byCode(String code) {
        return jdbc.sql("SELECT id, code, name, description FROM topics WHERE code = ?").param(code)
                .query(Topic.class).optional().orElseThrow(() -> new ApiException(ErrorCode.TOPIC_NOT_FOUND));
    }
}
