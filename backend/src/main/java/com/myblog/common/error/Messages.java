package com.myblog.common.error;

/** 원본 문서 '안내 문구' 표 (FR-040). 말투는 "~합니다 / ~해 주세요". */
public final class Messages {
    private Messages() {}

    // 01-인증-인가
    public static final String EMAIL_INVALID = "이메일 형식이 올바르지 않습니다";
    public static final String EMAIL_TAKEN = "이미 가입된 이메일입니다";
    public static final String NICKNAME_RULE = "닉네임은 한글, 영문, 숫자로 2~10자여야 합니다";
    public static final String NICKNAME_TAKEN = "이미 사용 중인 닉네임입니다";
    public static final String PASSWORD_RULE = "비밀번호는 영문, 숫자, 특수문자를 포함해 8~64자로 입력해 주세요";
    public static final String PASSWORD_CONFIRM_MISMATCH = "비밀번호가 일치하지 않습니다";
    public static final String CODE_SENT = "인증번호를 보냈습니다. 10분 안에 입력해 주세요";
    public static final String CODE_MISMATCH = "인증번호가 올바르지 않습니다";
    public static final String CODE_EXPIRED = "인증번호가 만료되었습니다. 인증번호를 다시 받아 주세요";
    public static final String CODE_ATTEMPTS_EXCEEDED = "인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 받아 주세요";
    public static final String RESEND_TOO_SOON = "잠시 뒤에 다시 요청해 주세요";
    public static final String DAILY_LIMIT = "오늘은 더 이상 인증번호를 보낼 수 없습니다";
    public static final String VERIFIED = "이메일 인증이 완료되었습니다";
    public static final String NOT_VERIFIED = "이메일 인증을 먼저 완료해 주세요";
    public static final String VERIFICATION_EXPIRED = "인증 유효 시간이 지났습니다. 이메일 인증을 다시 해 주세요";
    public static final String SIGNUP_DONE = "가입이 완료되었습니다. 로그인해 주세요";
    public static final String MAIL_SEND_FAILED = "메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요";
    public static final String LOGIN_FAILED = "이메일 또는 비밀번호가 올바르지 않습니다";
    public static final String ACCOUNT_LOCKED = "로그인 시도가 5회 실패해 잠겼습니다. {N}분 뒤에 다시 시도해 주세요";
    public static final String RESET_SENT = "입력하신 이메일로 안내를 보냈습니다. 10분 안에 인증번호를 입력해 주세요";
    public static final String RESET_DONE = "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요";
    public static final String SOCIAL_SIGNUP_NOT_FOUND = "소셜 가입 정보가 없거나 만료되었습니다. 처음부터 다시 시도해 주세요";

    // 02-계정관리
    public static final String SAVED = "저장했습니다";
    public static final String CURRENT_PASSWORD_MISMATCH = "현재 비밀번호가 올바르지 않습니다";
    public static final String SAME_AS_CURRENT = "현재 비밀번호와 다른 값을 입력해 주세요";
    public static final String PASSWORD_CHANGED = "비밀번호를 변경했습니다";
    public static final String ACKNOWLEDGE_REQUIRED = "안내를 읽고 확인란에 체크해 주세요";
    public static final String PASSWORD_NOT_SET = "소셜 로그인으로 가입한 계정은 비밀번호 찾기로 비밀번호를 정할 수 있습니다";
    public static final String WITHDRAW_PHRASE_MISMATCH = "\"탈퇴합니다\"를 그대로 입력해 주세요";
    public static final String ACCOUNT_WITHDRAWN = "탈퇴 신청한 계정입니다. 보관 기간이 지나기 전이라 복구할 수 있습니다";
    public static final String EMAIL_WITHDRAWN =
            "탈퇴 처리 중인 이메일입니다. 로그인하면 복구할 수 있고, 보관 기간이 지나면 새로 가입할 수 있습니다";
    public static final String BIO_RULE = "소개는 100자 이하로 입력해 주세요";

    // 03-코어
    public static final String TITLE_REQUIRED = "제목을 입력해 주세요";
    public static final String TITLE_TOO_LONG = "제목은 100자 이하로 입력해 주세요";
    public static final String BODY_REQUIRED = "본문을 입력해 주세요";
    public static final String BODY_TOO_LONG = "본문은 10,000자 이하로 입력해 주세요";
    public static final String DRAFT_EMPTY = "제목이나 본문을 입력하면 임시저장할 수 있습니다";
    public static final String DRAFT_NOT_FOUND = "존재하지 않는 임시저장 글입니다";

    public static String pinLimit(int max) {
        return "대표글은 " + max + "개까지 고정할 수 있습니다. 다른 글의 고정을 먼저 풀어 주세요";
    }

    public static final String POSTS_REQUIRED = "글을 골라 주세요";

    public static String draftLimit(int max) {
        return "임시저장은 " + max + "개까지 할 수 있습니다. 쓰지 않는 임시저장 글을 지워 주세요";
    }
    public static final String CATEGORY_REQUIRED = "다이어리를 선택해 주세요";
    public static final String TOPIC_REQUIRED = "분야를 선택해 주세요";
    public static final String POST_NOT_FOUND = "존재하지 않는 글입니다";
    public static final String BLOG_NOT_FOUND = "존재하지 않는 블로그입니다";
    public static final String TOPIC_NOT_FOUND = "존재하지 않는 주제입니다";
    public static final String CATEGORY_NOT_FOUND = "존재하지 않는 다이어리입니다";
    public static final String CATEGORY_NAME_TAKEN = "이미 있는 다이어리입니다";
    public static final String CATEGORY_HAS_POSTS = "이 다이어리에 글이 {N}개 있어 삭제할 수 없습니다. 글을 다른 다이어리로 옮긴 뒤 삭제해 주세요";
    public static final String DEFAULT_CATEGORY = "기본 다이어리는 삭제할 수 없습니다";
    public static final String CATEGORY_NAME_REQUIRED = "다이어리 이름을 입력해 주세요";
    public static final String CATEGORY_NAME_TOO_LONG = "다이어리 이름은 20자 이하로 입력해 주세요";
    public static final String BLOG_NAME_REQUIRED = "블로그 이름을 입력해 주세요";
    public static final String BLOG_NAME_TOO_LONG = "블로그 이름은 30자 이하로 입력해 주세요";
    public static final String BLOG_DESCRIPTION_TOO_LONG = "소개는 200자 이하로 입력해 주세요";

    // 04-탐색
    public static final String QUERY_TOO_SHORT = "검색어를 2자 이상 입력해 주세요";

    // 05-소통-부가
    public static final String COMMENT_REQUIRED = "댓글 내용을 입력해 주세요";
    public static final String COMMENT_TOO_LONG = "댓글은 500자 이하로 입력해 주세요";
    public static final String COMMENT_TOO_SOON = "잠시 뒤에 다시 등록해 주세요";
    public static final String COMMENT_NOT_FOUND = "존재하지 않는 댓글입니다";
    public static final String REPLY_PARENT_NOT_FOUND = "답글을 달 댓글을 찾을 수 없습니다";
    public static final String OWN_POST = "내 글에는 할 수 없습니다";
    public static final String OWN_BLOG = "내 블로그는 구독할 수 없습니다";
    public static final String OWN_DIARY = "내 다이어리는 구독할 수 없습니다";
    public static final String PRIVATE_DIARY = "비공개 다이어리는 구독할 수 없습니다";
    public static final String SUBSCRIBERS_ONLY_DIARY = "블로그를 구독한 사람만 볼 수 있는 다이어리입니다";
    public static final String ALREADY_REPORTED = "이미 신고한 글입니다";
    public static final String REPORT_REASON_REQUIRED = "신고 사유를 골라 주세요";
    public static final String REPORT_DETAIL_TOO_LONG = "설명은 200자 이하로 입력해 주세요";
    public static final String INVALID_IMAGE = "이미지는 5MB 이하의 jpg, png, gif, webp만 올릴 수 있습니다";
    public static final String TOO_MANY_IMAGES = "이미지는 글 하나에 10장까지 올릴 수 있습니다";
    public static final String TOO_MANY_TAGS = "태그는 5개까지 붙일 수 있습니다";
    public static final String TAG_RULE = "태그는 공백과 쉼표 없이 1~15자로 입력해 주세요";
    public static final String BOOKMARK_FOLDER_NOT_FOUND = "존재하지 않는 폴더입니다";
    public static final String BOOKMARK_FOLDER_NAME_REQUIRED = "폴더 이름을 입력해 주세요";
    public static final String BOOKMARK_FOLDER_NAME_TOO_LONG = "폴더 이름은 20자 이하로 입력해 주세요";
    public static final String BOOKMARK_FOLDER_NAME_RESERVED = "쓸 수 없는 이름입니다";
    public static final String BOOKMARK_FOLDER_NAME_TAKEN = "같은 이름의 폴더가 이미 있습니다";

    public static String categoryDescriptionTooLong(int max) {
        return "다이어리 소개는 " + max + "자 이하로 입력해 주세요";
    }

    public static String accountLocked(long minutes) {
        return ACCOUNT_LOCKED.replace("{N}", String.valueOf(minutes));
    }

    public static String categoryHasPosts(long count) {
        return CATEGORY_HAS_POSTS.replace("{N}", String.valueOf(count));
    }

    // 스티커 상점
    public static final String INSUFFICIENT_INK = "잉크가 부족해요";
    public static final String ALREADY_OWNED = "이미 가진 스티커예요";
    public static final String PACK_NOT_FOUND = "존재하지 않는 스티커 팩입니다";
    public static final String CHALLENGE_NOT_FOUND = "존재하지 않는 도전과제입니다";
    public static final String CHALLENGE_NOT_DONE = "아직 도전과제를 다 깨지 못했어요";
    public static final String ALREADY_CLAIMED = "이미 보상을 받았어요";
    public static final String STICKER_NOT_OWNED = "가진 스티커만 붙일 수 있어요";
    public static final String STICKER_SLOT_INVALID = "스티커 자리를 다시 골라 주세요";

    public static String tooManyStickers(int max) {
        return "스티커는 다이어리마다 " + max + "개까지 붙일 수 있어요";
    }
}
