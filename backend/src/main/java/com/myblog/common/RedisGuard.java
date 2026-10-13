package com.myblog.common;

import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.util.Optional;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * Redis 장애를 다루는 두 방식.
 * required: 인증번호처럼 Redis 없이는 할 수 없는 일 → SERVICE_UNAVAILABLE.
 * optional: 조회수·연속 등록 방지처럼 건너뛰어도 되는 일 → 빈 값.
 * 로그인 세션도 Redis에 있으므로(Spring Session) Redis가 꺼지면 로그인은 안 되고, 로그인 없이 글 읽기는 된다.
 */
@Component
public class RedisGuard {
    private static final Logger log = LoggerFactory.getLogger(RedisGuard.class);

    public <T> T required(Supplier<T> action) {
        try {
            return action.get();
        } catch (DataAccessException e) {
            log.warn("Redis unavailable: {}", e.getMessage());
            throw new ApiException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public <T> Optional<T> optional(Supplier<T> action) {
        try {
            return Optional.ofNullable(action.get());
        } catch (DataAccessException e) {
            log.warn("Redis unavailable, skipping: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
