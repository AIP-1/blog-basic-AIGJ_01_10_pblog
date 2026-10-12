/**
 * 화면 문구 (FR-040). 원본 docs/상세/*.md 의 '안내 문구' 표를 그대로 옮겼다.
 * 표에 없는 문구는 같은 말투("~합니다 / ~해 주세요")로 새로 썼고 [추가] 표시를 달았다.
 */

/** 01-인증-인가 '안내 문구' */
export const AUTH = {
  emailInvalid: '이메일 형식이 올바르지 않습니다',
  emailTaken: '이미 가입된 이메일입니다',
  nicknameRule: '닉네임은 한글, 영문, 숫자로 2~10자여야 합니다',
  nicknameTaken: '이미 사용 중인 닉네임입니다',
  passwordRule: '비밀번호는 영문, 숫자, 특수문자를 포함해 8~64자로 입력해 주세요',
  passwordMismatch: '비밀번호가 일치하지 않습니다',
  codeSent: '인증번호를 보냈습니다. 10분 안에 입력해 주세요',
  codeMismatch: '인증번호가 올바르지 않습니다',
  codeExpired: '인증번호가 만료되었습니다. 인증번호를 다시 받아 주세요',
  codeAttemptsExceeded: '인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 받아 주세요',
  resendTooSoon: '잠시 뒤에 다시 요청해 주세요',
  dailyLimit: '오늘은 더 이상 인증번호를 보낼 수 없습니다',
  verified: '이메일 인증이 완료되었습니다',
  notVerified: '이메일 인증을 먼저 완료해 주세요',
  verificationExpired: '인증 유효 시간이 지났습니다. 이메일 인증을 다시 해 주세요',
  signupDone: '가입이 완료되었습니다. 로그인해 주세요',
  mailSendFailed: '메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요',
  loginFailed: '이메일 또는 비밀번호가 올바르지 않습니다',
  accountLocked: (minutes: number) =>
    `로그인 시도가 5회 실패해 잠겼습니다. ${minutes}분 뒤에 다시 시도해 주세요`,
  resetSent: '입력하신 이메일로 안내를 보냈습니다. 10분 안에 인증번호를 입력해 주세요',
  resetDone: '비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요',
  restoreConfirm: (until: string | null) =>
    `탈퇴 신청한 계정입니다.${until ? ` ${until}까지` : ''} 복구할 수 있습니다. 지금 복구하고 로그인할까요?`,
  withdrawnNotRestored: '탈퇴 신청한 계정입니다. 복구하려면 다시 로그인해 주세요',
  // [추가]
  required: '필수 입력 항목입니다',
  codeRequired: '인증번호를 입력해 주세요',
  forgotPassword: '비밀번호를 잊으셨나요?',
  loginRequired: '로그인이 필요합니다',
  resetWhileLoggedIn: '로그인한 상태에서는 마이페이지에서 비밀번호를 변경해 주세요',
} as const;

/** 02-계정관리 '안내 문구' */
export const ACCOUNT = {
  saved: '저장했습니다',
  currentPasswordMismatch: '현재 비밀번호가 올바르지 않습니다',
  sameAsCurrent: '현재 비밀번호와 다른 값을 입력해 주세요',
  passwordChanged: '비밀번호를 변경했습니다',
  withdrawConfirm: (days: number) => `정말 탈퇴하시겠습니까? ${days}일 안에 로그인하면 복구할 수 있습니다`,
  withdrawn: '탈퇴 신청이 완료되었습니다',
  // [추가]
  bioTooLong: (max: number) => `소개는 ${max}자 이하로 입력해 주세요`,
  acknowledgeRequired: '안내를 확인했다는 항목에 체크해 주세요',
} as const;

/** 03-코어-블로그-글 '안내 문구' */
export const POST = {
  titleRequired: '제목을 입력해 주세요',
  bodyRequired: '본문을 입력해 주세요',
  leaveConfirm: '저장하지 않은 내용이 있습니다. 나갈까요?',
  draftEmpty: '제목이나 본문을 입력하면 임시저장할 수 있습니다',
  draftSaved: (time: string, auto: boolean) => `${auto ? '자동 ' : ''}임시저장 ${time}`,
  draftDeleteConfirm: '이 임시저장 글을 삭제할까요?',
  draftNone: '임시저장한 글이 없습니다',
  draftNoTitle: '(제목 없음)',
  deleteConfirm: '삭제하면 되돌릴 수 없습니다. 삭제할까요?',
  toPublicConfirm: '공개로 바꾸면 누구나 볼 수 있습니다',
  notFound: '존재하지 않는 글입니다',
  categoryNameTaken: '이미 있는 다이어리입니다',
  categoryHasPosts: (n: number) =>
    `이 다이어리에 글이 ${n}개 있어 삭제할 수 없습니다. 글을 다른 다이어리로 옮긴 뒤 삭제해 주세요`,
  // [추가]
  titleTooLong: (max: number) => `제목은 ${max}자 이하로 입력해 주세요`,
  bodyTooLong: (max: number) => `본문은 ${max.toLocaleString()}자 이하로 입력해 주세요`,
  categoryRequired: '다이어리를 골라 주세요',
  defaultCategory: '"미분류"는 삭제할 수 없습니다',
  categoryDeleteConfirm: '다이어리를 삭제할까요?',
  tagLimit: (max: number) => `태그는 ${max}개까지 붙일 수 있습니다`,
  tagRule: (max: number) => `태그는 공백과 쉼표 없이 1~${max}자로 입력해 주세요`,
  tagDuplicate: '이미 붙인 태그입니다',
  imageLimit: (max: number) => `이미지는 글 하나에 ${max}장까지 올릴 수 있습니다`,
  privateBadge: '비공개',
} as const;

/** 04-탐색 '안내 문구' */
export const EXPLORE = {
  emptyList: '글이 없습니다',
  searchTooShort: '검색어를 2자 이상 입력해 주세요',
  searchNoResult: '검색 결과가 없습니다',
  // [추가] CF-10-8
  firstPost: '첫 글을 써 보세요',
  searchEmpty: '검색어를 입력해 주세요',
  searchTooLong: (max: number) => `검색어는 ${max}자 이하로 입력해 주세요`,
  searchTotal: (n: number) => `검색 결과 ${n.toLocaleString()}건`,
  postCount: (n: number) => `${n.toLocaleString()}개의 글`,
} as const;

/** 05-소통-부가 '안내 문구' */
export const SOCIAL = {
  commentLoginRequired: '로그인한 회원만 댓글을 쓸 수 있습니다',
  commentDeleteConfirm: '댓글을 삭제할까요?',
  commentDeleteWithRepliesConfirm: '댓글을 삭제할까요? 이 댓글에 달린 답글도 함께 삭제됩니다',
  commentDeleteMaybeRepliesConfirm: '댓글을 삭제할까요? 답글이 있으면 함께 삭제됩니다',
  imageRule: '이미지는 5MB 이하의 jpg, png, gif, webp만 올릴 수 있습니다',
  alreadyReported: '이미 신고한 글입니다',
  reported: '신고가 접수되었습니다',
  // [추가]
  withdrawnUser: '탈퇴한 사용자',
  commentRequired: '댓글 내용을 입력해 주세요',
  commentTooLong: (max: number) => `댓글은 ${max}자 이하로 입력해 주세요`,
  ownPost: '자기 글에는 할 수 없습니다',
  reportReasonRequired: '신고 사유를 골라 주세요',
} as const;

/** 06-블로그관리-통계 '안내 문구' */
export const MANAGE = {
  noPostsYet: '아직 쓴 글이 없습니다',
  noFilteredPosts: '글이 없습니다',
  noComments: '아직 달린 댓글이 없습니다',
  blogNameRequired: '블로그 이름을 입력해 주세요',
  categoryNameRequired: '다이어리 이름을 입력해 주세요',
  // BM-04-4 (화면 아래 상시 안내)
  categoryNotice:
    '글이 하나라도 있는 다이어리는 삭제할 수 없습니다. 글은 글 수정에서 다른 다이어리로 옮길 수 있습니다.',
  // [추가]
  blogNameTooLong: (max: number) => `블로그 이름은 ${max}자 이하로 입력해 주세요`,
  categoryNameTooLong: (max: number) => `다이어리 이름은 ${max}자 이하로 입력해 주세요`,
  noData: '아직 기록이 없습니다',
} as const;

/** 다이어리 (데모의 다이어리 컨셉: 분류 = 다이어리) */
export const CATEGORY = {
  nameRequired: '다이어리 이름을 입력해 주세요',
  nameTooLong: (max: number) => `다이어리 이름은 ${max}자 이하로 입력해 주세요`,
  descriptionTooLong: (max: number) => `다이어리 소개는 ${max}자 이하로 입력해 주세요`,
  toPrivateConfirm: '비공개로 바꾸면 이 다이어리의 글은 나만 볼 수 있습니다. 바꿀까요?',
  saved: '다이어리 설정을 저장했습니다',
  privateNote: '나만 볼 수 있는 다이어리입니다',
  tagFilterClear: '✕ 태그 거르기 해제',
  emptyTag: '이 태그가 붙은 글이 없습니다',
  writeHere: '이 다이어리에 쓰기',
  pin: '대표글로 고정',
  unpin: '대표글 해제',
  pinned: '대표글로 고정했습니다',
  unpinned: '대표글 고정을 풀었습니다',
  pinnedTitle: '대표글',
  pinnedHint: '글 화면에서 고정 · 해제할 수 있습니다',
  edit: '편집',
  editDone: '완료',
  selectAll: '전체 선택',
  selected: (n: number) => `${n}개 선택`,
  moveTo: '옮길 다이어리',
  move: '이동',
  moveConfirm: (n: number, to: string) => `고른 글 ${n}개를 '${to}' 다이어리로 옮길까요?`,
  moved: (n: number) => `글 ${n}개를 옮겼습니다`,
  bulkDeleteConfirm: (n: number) => `고른 글 ${n}개를 삭제할까요? 댓글과 좋아요도 함께 지워지고 되돌릴 수 없습니다`,
  bulkDeleted: (n: number) => `글 ${n}개를 삭제했습니다`,
  editEmpty: '이 다이어리에는 글이 없습니다',
} as const;

/** 요구사항.md 3.3~3.5 및 공통 */
/** 공지사항 */
export const NOTICE = {
  title: '공지사항',
  desc: '서비스 소식과 버전별로 바뀐 점을 알려 드려요.',
  empty: '아직 공지사항이 없어요',
  more: '전체 보기',
} as const;

export const COMMON = {
  notFound: (what: string) => `존재하지 않는 ${what}입니다`,
  noBlogs: '블로그가 없습니다',
  noPosts: '글이 없습니다',
  loading: '불러오는 중입니다',
  // [추가]
  genericError: '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요',
  networkError: '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요',
  forbidden: '볼 수 없는 화면입니다',
  retry: '다시 시도',
} as const;

/** 서버 오류 코드 → 화면 문구. 서버가 message를 주면 그쪽을 우선한다. */
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: AUTH.emailTaken,
  NICKNAME_TAKEN: AUTH.nicknameTaken,
  RESEND_TOO_SOON: AUTH.resendTooSoon,
  DAILY_LIMIT: AUTH.dailyLimit,
  MAIL_SEND_FAILED: AUTH.mailSendFailed,
  SERVICE_UNAVAILABLE: AUTH.mailSendFailed,
  CODE_MISMATCH: AUTH.codeMismatch,
  CODE_EXPIRED: AUTH.codeExpired,
  CODE_ATTEMPTS_EXCEEDED: AUTH.codeAttemptsExceeded,
  NOT_VERIFIED: AUTH.notVerified,
  VERIFICATION_EXPIRED: AUTH.verificationExpired,
  LOGIN_FAILED: AUTH.loginFailed,
  CURRENT_PASSWORD_MISMATCH: ACCOUNT.currentPasswordMismatch,
  SAME_AS_CURRENT: ACCOUNT.sameAsCurrent,
  ACKNOWLEDGE_REQUIRED: ACCOUNT.acknowledgeRequired,
  POST_NOT_FOUND: POST.notFound,
  BLOG_NOT_FOUND: COMMON.notFound('블로그'),
  TOPIC_NOT_FOUND: COMMON.notFound('주제'),
  CATEGORY_NAME_TAKEN: POST.categoryNameTaken,
  DEFAULT_CATEGORY: POST.defaultCategory,
  ALREADY_REPORTED: SOCIAL.alreadyReported,
  OWN_POST: SOCIAL.ownPost,
  INVALID_IMAGE: SOCIAL.imageRule,
  QUERY_TOO_SHORT: EXPLORE.searchTooShort,
  UNAUTHENTICATED: AUTH.loginRequired,
  NETWORK_ERROR: COMMON.networkError,
};
