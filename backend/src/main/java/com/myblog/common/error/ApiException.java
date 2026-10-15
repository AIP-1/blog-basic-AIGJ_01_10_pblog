package com.myblog.common.error;

import java.util.Map;

public class ApiException extends RuntimeException {
    private final ErrorCode code;
    private final Map<String, String> fields;
    // 직렬화하지 않는다. 오류 응답 JSON은 details()로 바로 만든다.
    private final transient Map<String, Object> details;

    public ApiException(ErrorCode code) {
        this(code, code.message(), Map.of(), Map.of());
    }

    public ApiException(ErrorCode code, String message, Map<String, String> fields, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.fields = fields;
        this.details = details;
    }

    /** 칸 하나의 입력 오류. 문구는 칸 아래에 그대로 보인다. */
    public static ApiException field(String field, String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message, Map.of(field, message), Map.of());
    }

    public static ApiException withDetails(ErrorCode code, String message, Map<String, Object> details) {
        return new ApiException(code, message, Map.of(), details);
    }

    public ErrorCode code() {
        return code;
    }

    public Map<String, String> fields() {
        return fields;
    }

    public Map<String, Object> details() {
        return details;
    }
}
