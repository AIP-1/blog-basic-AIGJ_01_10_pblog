package com.myblog.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 누가 보든 같은 공개 화면(메인, 분야별 글, 주제 화면)의 응답을 Redis에 JSON으로 잠깐 둔다.
 * 키에 세대 번호를 붙여서, 글이 바뀌면 번호만 올려 옛 캐시를 한꺼번에 버린다(KEYS 검색 없이, 서버가 여러 대여도).
 * 캐시가 비었을 때 같은 키를 동시에 요청하면 한 요청만 DB에서 계산하고 나머지는 그 결과를 쓴다.
 * Redis가 꺼져 있으면 캐시 없이 바로 계산한다(RedisGuard.optional).
 */
@Component
public class ResponseCache {
    private static final Logger log = LoggerFactory.getLogger(ResponseCache.class);
    private static final String PREFIX = "myblog:cache:";
    private static final String GENERATION = PREFIX + "generation";

    private final StringRedisTemplate redis;
    private final RedisGuard guard;
    private final ObjectMapper json;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    public ResponseCache(StringRedisTemplate redis, RedisGuard guard, ObjectMapper json) {
        this.redis = redis;
        this.guard = guard;
        this.json = json;
    }

    /** 캐시에 있으면 그 값(JSON을 Map/List로 읽은 것), 없으면 loader로 계산해 ttl 동안 둔다. ttl이 0이면 캐시하지 않는다. */
    public Object get(String name, Duration ttl, Supplier<?> loader) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            return loader.get();
        }
        String gen = generation();
        if (gen == null) {
            return loader.get(); // Redis가 꺼져 있다
        }
        String key = PREFIX + gen + ":" + name;
        Object cached = read(key);
        if (cached != null) {
            return cached;
        }
        synchronized (locks.computeIfAbsent(key, k -> new Object())) {
            try {
                cached = read(key);
                if (cached != null) {
                    return cached;
                }
                Object value = loader.get();
                write(key, value, ttl);
                return value;
            } finally {
                locks.remove(key);
            }
        }
    }

    /** 공개 글 목록이 바뀌었을 때 부른다. 트랜잭션 안이면 커밋한 뒤에 버린다(커밋 전 값이 다시 캐시되지 않게). */
    public void invalidate() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    bump();
                }
            });
        } else {
            bump();
        }
    }

    private void bump() {
        guard.optional(() -> redis.opsForValue().increment(GENERATION));
    }

    /** 지금 세대 번호. 아직 없으면 "0", Redis가 꺼져 있으면 null. */
    private String generation() {
        return guard.optional(() -> {
            String g = redis.opsForValue().get(GENERATION);
            return g == null ? "0" : g;
        }).orElse(null);
    }

    private Object read(String key) {
        String s = guard.optional(() -> redis.opsForValue().get(key)).orElse(null);
        if (s == null) {
            return null;
        }
        try {
            return json.readValue(s, Object.class);
        } catch (JsonProcessingException e) {
            log.warn("Broken cache entry {}, recomputing", key);
            return null;
        }
    }

    private void write(String key, Object value, Duration ttl) {
        try {
            String s = json.writeValueAsString(value);
            guard.optional(() -> {
                redis.opsForValue().set(key, s, ttl);
                return Boolean.TRUE;
            });
        } catch (JsonProcessingException e) {
            log.warn("Cannot cache {}: {}", key, e.getMessage());
        }
    }
}
