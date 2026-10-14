package com.myblog.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** ResponseCache의 갈래: 캐시 끔, 적중, 빈 캐시, Redis 장애, 깨진 값, 커밋 뒤 무효화. */
class ResponseCacheTest {
    private static final Duration TTL = Duration.ofSeconds(30);

    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> ops = mock(ValueOperations.class);
    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    private final ResponseCache cache;
    private final AtomicInteger loads = new AtomicInteger();

    ResponseCacheTest() {
        when(redis.opsForValue()).thenReturn(ops);
        cache = new ResponseCache(redis, new RedisGuard(), new ObjectMapper());
    }

    private Map<String, Object> load() {
        loads.incrementAndGet();
        return Map.of("items", List.of(1, 2));
    }

    @AfterEach
    void clearTx() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void zeroTtlSkipsRedis() {
        assertThat(cache.get("home", Duration.ZERO, this::load)).isEqualTo(load());
        verify(redis, never()).opsForValue();
    }

    @Test
    void missLoadsAndStores() {
        when(ops.get("myblog:cache:generation")).thenReturn("3");
        assertThat(cache.get("home", TTL, this::load)).isEqualTo(Map.of("items", List.of(1, 2)));
        assertThat(loads).hasValue(1);
        verify(ops).set(eq("myblog:cache:3:home"), eq("{\"items\":[1,2]}"), eq(TTL));
    }

    @Test
    void hitSkipsLoader() {
        when(ops.get("myblog:cache:generation")).thenReturn(null); // 처음엔 세대 0
        when(ops.get("myblog:cache:0:home")).thenReturn("{\"items\":[1,2]}");
        assertThat(cache.get("home", TTL, this::load)).isEqualTo(Map.of("items", List.of(1, 2)));
        assertThat(loads).hasValue(0);
    }

    @Test
    void redisDownFallsBackToLoader() {
        when(ops.get(anyString())).thenThrow(new RedisConnectionFailureException("down"));
        assertThat(cache.get("home", TTL, this::load)).isEqualTo(Map.of("items", List.of(1, 2)));
        assertThat(loads).hasValue(1);
        verify(ops, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void brokenEntryIsRecomputed() {
        when(ops.get("myblog:cache:generation")).thenReturn("0");
        when(ops.get("myblog:cache:0:home")).thenReturn("{not json");
        assertThat(cache.get("home", TTL, this::load)).isEqualTo(Map.of("items", List.of(1, 2)));
        assertThat(loads).hasValue(1);
    }

    @Test
    void unserializableValueIsReturnedButNotStored() {
        when(ops.get("myblog:cache:generation")).thenReturn("0");
        Object odd = new Object(); // Jackson이 쓸 수 없는 값
        assertThat(cache.get("home", TTL, () -> odd)).isSameAs(odd);
        verify(ops, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void invalidateOutsideTransactionBumpsNow() {
        cache.invalidate();
        verify(ops).increment("myblog:cache:generation");
    }

    @Test
    void invalidateInTransactionWaitsForCommit() {
        TransactionSynchronizationManager.initSynchronization();
        cache.invalidate();
        verify(ops, never()).increment(anyString());
        for (TransactionSynchronization s : TransactionSynchronizationManager.getSynchronizations()) {
            s.afterCommit();
        }
        verify(ops).increment("myblog:cache:generation");
    }
}
