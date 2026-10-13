package com.myblog.common.error;

import org.springframework.http.HttpStatus;

/** contracts/api.md의 오류 코드. 문구는 원본 '안내 문구' 표를 따른다 (FR-040). */
public enum ErrorCode {
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다"),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "입력한 내용을 확인해 주세요"),
    DUPLICATE_SUBMIT(HttpStatus.CONFLICT, "요청을 처리하고 있습니다. 잠시만 기다려 주세요"),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "잠시 뒤 다시 시도해 주세요"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요"),

    EMAIL_TAKEN(HttpStatus.CONFLICT, Messages.EMAIL_TAKEN),
    NICKNAME_TAKEN(HttpStatus.CONFLICT, Messages.NICKNAME_TAKEN),
    RESEND_TOO_SOON(HttpStatus.TOO_MANY_REQUESTS, Messages.RESEND_TOO_SOON),
    DAILY_LIMIT(HttpStatus.TOO_MANY_REQUESTS, Messages.DAILY_LIMIT),
    MAIL_SEND_FAILED(HttpStatus.SERVICE_UNAVAILABLE, Messages.MAIL_SEND_FAILED),
    CODE_MISMATCH(HttpStatus.BAD_REQUEST, Messages.CODE_MISMATCH),
    CODE_EXPIRED(HttpStatus.BAD_REQUEST, Messages.CODE_EXPIRED),
    CODE_ATTEMPTS_EXCEEDED(HttpStatus.BAD_REQUEST, Messages.CODE_ATTEMPTS_EXCEEDED),
    NOT_VERIFIED(HttpStatus.BAD_REQUEST, Messages.NOT_VERIFIED),
    VERIFICATION_EXPIRED(HttpStatus.BAD_REQUEST, Messages.VERIFICATION_EXPIRED),
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, Messages.LOGIN_FAILED),
    ACCOUNT_LOCKED(HttpStatus.LOCKED, Messages.ACCOUNT_LOCKED),
    CURRENT_PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, Messages.CURRENT_PASSWORD_MISMATCH),
    SAME_AS_CURRENT(HttpStatus.BAD_REQUEST, Messages.SAME_AS_CURRENT),
    ACKNOWLEDGE_REQUIRED(HttpStatus.BAD_REQUEST, Messages.ACKNOWLEDGE_REQUIRED),
    PASSWORD_NOT_SET(HttpStatus.BAD_REQUEST, Messages.PASSWORD_NOT_SET),
    ACCOUNT_WITHDRAWN(HttpStatus.CONFLICT, Messages.ACCOUNT_WITHDRAWN),
    EMAIL_WITHDRAWN(HttpStatus.CONFLICT, Messages.EMAIL_WITHDRAWN),
    SOCIAL_SIGNUP_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.SOCIAL_SIGNUP_NOT_FOUND),

    TOPIC_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.TOPIC_NOT_FOUND),
    BLOG_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.BLOG_NOT_FOUND),
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.POST_NOT_FOUND),
    DRAFT_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.DRAFT_NOT_FOUND),
    PIN_LIMIT(HttpStatus.CONFLICT, Messages.pinLimit(3)),
    DRAFT_LIMIT(HttpStatus.CONFLICT, Messages.draftLimit(20)),
    CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.CATEGORY_NOT_FOUND),
    CATEGORY_NAME_TAKEN(HttpStatus.CONFLICT, Messages.CATEGORY_NAME_TAKEN),
    CATEGORY_HAS_POSTS(HttpStatus.CONFLICT, Messages.CATEGORY_HAS_POSTS),
    DEFAULT_CATEGORY(HttpStatus.CONFLICT, Messages.DEFAULT_CATEGORY),

    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.COMMENT_NOT_FOUND),
    COMMENT_TOO_SOON(HttpStatus.TOO_MANY_REQUESTS, Messages.COMMENT_TOO_SOON),
    OWN_POST(HttpStatus.BAD_REQUEST, Messages.OWN_POST),
    OWN_BLOG(HttpStatus.BAD_REQUEST, Messages.OWN_BLOG),
    OWN_DIARY(HttpStatus.BAD_REQUEST, Messages.OWN_DIARY),
    PRIVATE_DIARY(HttpStatus.BAD_REQUEST, Messages.PRIVATE_DIARY),
    SUBSCRIBERS_ONLY_DIARY(HttpStatus.FORBIDDEN, Messages.SUBSCRIBERS_ONLY_DIARY),
    ALREADY_REPORTED(HttpStatus.CONFLICT, Messages.ALREADY_REPORTED),
    INVALID_IMAGE(HttpStatus.BAD_REQUEST, Messages.INVALID_IMAGE),
    TOO_MANY_IMAGES(HttpStatus.BAD_REQUEST, Messages.TOO_MANY_IMAGES),
    IMAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다"),
    TOO_MANY_TAGS(HttpStatus.BAD_REQUEST, Messages.TOO_MANY_TAGS),
    BOOKMARK_FOLDER_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.BOOKMARK_FOLDER_NOT_FOUND),
    BOOKMARK_FOLDER_NAME_TAKEN(HttpStatus.CONFLICT, Messages.BOOKMARK_FOLDER_NAME_TAKEN),
    QUERY_TOO_SHORT(HttpStatus.BAD_REQUEST, Messages.QUERY_TOO_SHORT),

    // 스티커 상점
    INSUFFICIENT_INK(HttpStatus.CONFLICT, Messages.INSUFFICIENT_INK),
    ALREADY_OWNED(HttpStatus.CONFLICT, Messages.ALREADY_OWNED),
    PACK_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.PACK_NOT_FOUND),
    CHALLENGE_NOT_FOUND(HttpStatus.NOT_FOUND, Messages.CHALLENGE_NOT_FOUND),
    CHALLENGE_NOT_DONE(HttpStatus.CONFLICT, Messages.CHALLENGE_NOT_DONE),
    ALREADY_CLAIMED(HttpStatus.CONFLICT, Messages.ALREADY_CLAIMED),
    STICKER_NOT_OWNED(HttpStatus.BAD_REQUEST, Messages.STICKER_NOT_OWNED),
    TOO_MANY_STICKERS(HttpStatus.BAD_REQUEST, Messages.tooManyStickers(3));

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus status() {
        return status;
    }

    public String message() {
        return message;
    }
}
