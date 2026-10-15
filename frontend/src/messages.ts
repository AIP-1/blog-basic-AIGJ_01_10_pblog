/**
 * 화면 문구 (FR-040). 원본 docs/상세/*.md 의 '안내 문구' 표를 그대로 옮겼다.
 * 표에 없는 문구는 같은 말투("~합니다 / ~해 주세요")로 새로 썼고 [추가] 표시를 달았다.
 */

/** 01-인증-인가 '안내 문구' */
export const AUTH = {
  signupFoot: '가입하면 내 블로그가 하나 생겨요.',
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
  restoreConfirm: (until: string | null) => {
    const untilText = until ? ` ${until}까지` : '';
    return `탈퇴 신청한 계정입니다.${untilText} 복구할 수 있습니다. 지금 복구하고 로그인할까요?`;
  },
  withdrawnNotRestored: '탈퇴 신청한 계정입니다. 복구하려면 다시 로그인해 주세요',
  // [추가]
  required: '필수 입력 항목입니다',
  codeRequired: '인증번호를 입력해 주세요',
  forgotPassword: '비밀번호를 잊으셨나요?',
  loginRequired: '로그인이 필요합니다',
  resetWhileLoggedIn: '로그인한 상태에서는 내 정보에서 비밀번호를 변경해 주세요',
} as const;

/** 소셜 로그인 (카카오·구글) [추가] */
export const SOCIAL_LOGIN = {
  providerName: { kakao: '카카오', google: '구글' } as Record<string, string>,
  start: (provider: string) => `${provider}로 시작하기`,
  divider: '또는',
  signupTitle: (provider: string) => `${provider}로 가입`,
  signupIntro: '사각에서 쓸 닉네임을 정하면 가입이 끝나요. 내 블로그도 하나 생겨요.',
  emailHint: (provider: string) => `로그인에 쓴 계정의 이메일이에요. 이 계정은 ${provider}로만 로그인해요.`,
  signupSubmit: '가입하기',
  signupSubmitting: '가입하는 중…',
  signupDone: '가입이 완료되었습니다. 환영해요!',
  pendingMissing: '소셜 가입 정보가 없거나 만료되었습니다. 처음부터 다시 시도해 주세요',
  backHome: '홈으로',
  withdrawn: '탈퇴 신청한 계정입니다. 복구하려면 이메일과 비밀번호로 로그인해 주세요',
  noEmail: '이메일 정보를 받지 못해 로그인할 수 없습니다. 이메일 제공에 동의하고 다시 시도해 주세요',
  failed: '소셜 로그인에 실패했습니다. 잠시 뒤 다시 시도해 주세요',
  restored: '탈퇴 신청을 취소하고 계정을 복구했어요. 다시 만나서 반가워요!',
  connected: (providers: string) => `${providers} 계정으로 로그인해요`,
  emailAccount: '이메일로 가입한 계정입니다. 이메일과 비밀번호로 로그인해 주세요',
  otherProvider: (provider: string) => `${provider}로 가입한 이메일입니다. ${provider}로 로그인해 주세요`,
  withdrawDone: '탈퇴 신청이 완료되었습니다',
  withdrawMismatch: '가입한 계정과 다른 계정으로 확인해 탈퇴하지 않았습니다. 가입한 계정으로 다시 시도해 주세요',
  withdrawCancelled: '탈퇴 확인을 취소해 탈퇴하지 않았습니다',
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
  socialWithdrawHint: (provider: string) =>
    `비밀번호 대신 ${provider} 계정으로 본인을 확인합니다. ${provider} 로그인 화면에서 가입한 계정으로 다시 로그인하면 탈퇴가 완료됩니다.`,
  socialWithdrawButton: (provider: string) => `${provider}로 확인하고 탈퇴하기`,
  passwordNotSet: '소셜 로그인으로 가입한 계정은 비밀번호가 없습니다',
} as const;

/** 03-코어-블로그-글 '안내 문구' */
export const POST = {
  linkCopied: '글 주소를 복사했어요',
  copyPrompt: '글 주소를 복사해 주세요',
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
  defaultCategory: '기본 다이어리는 삭제할 수 없습니다',
  categoryDeleteConfirm: '다이어리를 삭제할까요?',
  tagLimit: (max: number) => `태그는 ${max}개까지 붙일 수 있습니다`,
  tagRule: (max: number) => `태그는 공백과 쉼표 없이 1~${max}자로 입력해 주세요`,
  tagDuplicate: '이미 붙인 태그입니다',
  imageLimit: (max: number) => `이미지는 글 하나에 ${max}장까지 올릴 수 있습니다`,
  privateBadge: '비공개',
} as const;

/** 04-탐색 '안내 문구' */
export const EXPLORE = {
  searchStart: '찾을 단어를 넣어 주세요',
  searchHint: '모든 블로그의 공개 글과 블로그 이름에서 찾아요. 여러 단어를 쓰면 모든 단어가 들어 있는 것만 보여 줘요.',
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
/** 메인 */
export const HOME = {
  weeklyTitle: '이번 주 인기 글',
  weeklyEmpty: '최근 7일 동안 올라온 공개 글이 없어요.',
  recommendTitle: '추천 글',
  recommendHint: '글을 읽으면 취향에 맞게 바뀌어요',
  recommendBased: '읽은 글을 바탕으로 골랐어요',
  recommendOff: '추천 기록을 꺼 두었어요 · 인기 글을 대신 보여 드려요',
  recommendEmpty: '아직 추천할 글이 없어요.',
  recommendOffNote: '추천 기록이 꺼져 있어요.',
  recommendUses: (n: number) => `추천에 이 브라우저에서 읽은 글 ${n}개를 써요.`,
  feedTitle: '분야별 글',
  feedEmpty: '이 분야에는 아직 공개 글이 없어요',
  popularHint: '인기 점수 = 조회 + 좋아요 ×5 + 댓글 단 사람 ×3 + 책갈피 ×4',
  diariesTitle: '인기 다이어리',
  blogsTitle: '블로그 둘러보기',
} as const;

/** 공지사항 */
export const BOOKMARK = {
  title: '책갈피',
  button: '책갈피',
  /** 글 아래 버튼: 꽂아 둔 글이면 폴더 이름을 붙인다 */
  buttonOn: (folder: string) => `책갈피 · ${folder}`,
  pickTitle: '어디에 저장할까요?',
  savedTitle: '책갈피',
  none: '미분류',
  all: '전체',
  newFolderName: '새 폴더 이름',
  addFolder: '+ 폴더',
  remove: '책갈피 빼기',
  cancel: '취소',
  save: '책갈피',
  move: '옮기기',
  foldersLabel: '폴더',
  newFolder: '+ 새 폴더',
  newFolderTitle: '새 폴더',
  renameFolder: '이름 바꾸기',
  renameFolderTitle: '폴더 이름 바꾸기',
  deleteFolder: '폴더 삭제',
  folderName: '폴더 이름',
  folderSave: '저장',
  deleteFolderTitle: (name: string) => `‘${name}’ 폴더를 지울까요?`,
  deleteFolderBody: (n: number) => `안에 있는 글 ${n}개는 미분류로 옮겨져요. 글이 지워지지는 않아요.`,
  savedAgo: (ago: string) => `${ago}에 저장`,
  folderSelect: '폴더',
  moveLabel: '폴더 옮기기',
  removeLabel: (title: string) => `‘${title}’ 책갈피 빼기`,
  empty: '아직 책갈피한 글이 없어요',
  emptyFolder: '이 폴더에는 아직 글이 없어요',
  emptyHint: '마음에 드는 글 아래의 ‘책갈피’를 눌러 보세요.',
} as const;

/** 구독 (데모 '구독': 블로그 전체 또는 다이어리 한 권) */
export const SUBSCRIBE = {
  nav: '구독',
  title: '구독',
  tabsLabel: '구독 종류',
  tabs: { all: '전체', diary: '다이어리', blog: '블로그' },
  feedTitle: { all: '구독한 다이어리 · 블로그의 새 글', diary: '구독한 다이어리의 새 글', blog: '구독한 블로그의 새 글' },
  total: (n: number) => `${n.toLocaleString()}개`,
  /** 구독한 것이 없을 때: '아직 구독한 ~가 없어요' */
  emptyWhat: { all: '다이어리나 블로그', diary: '다이어리', blog: '블로그' },
  empty: (what: string) => `아직 구독한 ${what}가 없어요`,
  emptyHint: (what: string) => `마음에 드는 ${what}에서 ‘+ 구독’을 눌러 보세요.`,
  browse: '글 둘러보기',
  feedEmpty: '아직 공개 글이 없어요',
  diariesTitle: '구독한 다이어리',
  blogsTitle: '구독한 블로그',
  asideEmpty: '아직 없어요.',
  allDiaries: '모든 공개 다이어리',
  blogSubscribe: '+ 블로그 구독',
  blogSubscribed: '✓ 블로그 구독 중',
  blogHint: '이 블로그의 모든 공개 다이어리를 받아 봐요',
  diarySubscribe: '+ 다이어리 구독',
  diarySubscribed: '✓ 구독 중',
  added: '구독했어요',
  removed: '구독을 취소했어요',
  /** 블로그 머리: 블로그 구독자 수 */
  blogCount: (n: number) => `블로그 구독자 ${n.toLocaleString()}명`,
  count: (n: number) => `구독자 ${n.toLocaleString()}명`,
  ownBlog: '내 블로그는 구독할 수 없습니다',
  ownDiary: '내 다이어리는 구독할 수 없습니다',
  privateDiary: '비공개 다이어리는 구독할 수 없습니다',
  subscribersOnlyDiary: '블로그를 구독한 사람만 볼 수 있는 다이어리예요.',
} as const;

/** 공개 범위 '구독자만'(일부공개): 그 블로그나 다이어리를 구독한 사람과 주인만 본다 */
export const SUB_VIS = {
  label: '구독자만',
  badge: '구독자 공개',
  postHint: '구독자만 볼 수 있어요',
  editorHint: '이 블로그나 다이어리를 구독한 사람만',
  diaryHint: '블로그나 이 다이어리를 구독한 사람만 볼 수 있어요',
  diaryNote: '구독자만 볼 수 있어요',
  /** 다이어리 설정 창의 공개 범위 설명 (데모 DIARY_VIS_HINT) */
  diaryVisHint: {
    PUBLIC: '누구나 읽고 구독할 수 있어요. 비공개로 쓴 글은 그대로 나만 봐요.',
    SUBSCRIBERS: '내 블로그나 이 다이어리를 구독한 사람만 볼 수 있어요. 메인 · 검색 · 인기 글에는 나오지 않아요.',
    PRIVATE: '나만 볼 수 있어요. 글을 공개로 써도 이 다이어리 안에서는 나만 봐요.',
  },
  subCountNote: (n: number) => `지금 구독자 ${n}명 — 비공개로 바꾸면 구독이 모두 해제돼요.`,
  /** 글쓰기 다이어리 고르기에 붙는 표시 */
  optionSuffix: { PUBLIC: '', SUBSCRIBERS: ' (구독자 공개)', PRIVATE: ' (비공개)' },
} as const;

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

/** 스티커 상점 [추가] */
export const SHOP = {
  nav: '상점',
  title: '스티커 상점',
  desc: '글을 쓰고 들를 때마다 잉크가 모여요. 잉크로 스티커를 사서 다이어리 표지를 꾸며 보세요.',
  ink: '잉크',
  inkAmount: (n: number) => `${n.toLocaleString()} 잉크`,
  tabs: { shop: '상점', mine: '내 스티커', challenges: '도전과제' },
  buy: '구매',
  owned: '가진 팩',
  buyConfirm: (name: string, price: number) => `'${name}' 팩을 ${price} 잉크에 살까요?`,
  bought: (name: string) => `'${name}' 팩을 샀어요. 다이어리 설정에서 표지에 붙여 보세요`,
  needLogin: '로그인하면 살 수 있어요',
  notEnough: (n: number) => `${n} 잉크가 더 필요해요`,
  limited: '한정',
  limitedHint: '도전과제로만 받을 수 있어요',
  mineEmpty: '아직 가진 스티커가 없어요. 상점에서 팩을 사거나 도전과제를 깨 보세요.',
  mineLoggedOut: '로그인하면 내 스티커를 볼 수 있어요',
  claim: '받기',
  claimed: '받음',
  claimedSticker: (name: string) => `'${name}' 스티커를 받았어요`,
  inProgress: '진행 중',
  reward: '보상',
  historyTitle: '잉크 내역',
  historyEmpty: '아직 내역이 없어요',
  howTitle: '잉크 모으기',
  howCheckin: (n: number) => `매일 출석 +${n}`,
  howPost: (n: number, max: number) => `공개 글 쓰기 +${n} (하루 ${max}번)`,
  howComment: (n: number, max: number) => `다른 사람 글에 댓글 +${n} (하루 ${max}번)`,
  today: (done: number, max: number) => `오늘 ${done}/${max}`,
  streak: (n: number) => `연속 출석 ${n}일`,
  checkedIn: '오늘 출석 완료',
  reasons: {
    CHECKIN: '출석',
    POST: '글쓰기',
    COMMENT: '댓글',
    CHALLENGE: '도전과제 보상',
    PURCHASE: '스티커 팩',
  } as Record<string, string>,
  earnedToast: (reason: string, amount: number) => `${reason} 잉크 +${amount}`,
  // 다이어리 표지 꾸미기
  coverTitle: '표지 스티커',
  coverHint: (max: number) => `가진 스티커를 ${max}개까지 붙일 수 있어요. 자리를 고르고 스티커를 눌러 주세요.`,
  coverEmpty: '아직 가진 스티커가 없어요.',
  coverGoShop: '상점 가기',
  coverMax: (max: number) => `스티커는 ${max}개까지 붙일 수 있어요`,
  coverRemove: '떼기',
  coverTilt: '기울기',
  slots: { TL: '왼쪽 위', TR: '오른쪽 위', C: '가운데', BL: '왼쪽 아래', BR: '오른쪽 아래' } as Record<string, string>,
  insufficientInk: '잉크가 부족해요',
  alreadyOwned: '이미 가진 스티커예요',
  alreadyClaimed: '이미 보상을 받았어요',
  notDone: '아직 도전과제를 다 깨지 못했어요',
  notOwned: '가진 스티커만 붙일 수 있어요',
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
  SOCIAL_SIGNUP_NOT_FOUND: SOCIAL_LOGIN.pendingMissing,
  CURRENT_PASSWORD_MISMATCH: ACCOUNT.currentPasswordMismatch,
  SAME_AS_CURRENT: ACCOUNT.sameAsCurrent,
  ACKNOWLEDGE_REQUIRED: ACCOUNT.acknowledgeRequired,
  PASSWORD_NOT_SET: ACCOUNT.passwordNotSet,
  POST_NOT_FOUND: POST.notFound,
  BLOG_NOT_FOUND: COMMON.notFound('블로그'),
  TOPIC_NOT_FOUND: COMMON.notFound('주제'),
  CATEGORY_NAME_TAKEN: POST.categoryNameTaken,
  DEFAULT_CATEGORY: POST.defaultCategory,
  ALREADY_REPORTED: SOCIAL.alreadyReported,
  OWN_POST: SOCIAL.ownPost,
  OWN_BLOG: SUBSCRIBE.ownBlog,
  OWN_DIARY: SUBSCRIBE.ownDiary,
  PRIVATE_DIARY: SUBSCRIBE.privateDiary,
  SUBSCRIBERS_ONLY_DIARY: SUBSCRIBE.subscribersOnlyDiary,
  INVALID_IMAGE: SOCIAL.imageRule,
  QUERY_TOO_SHORT: EXPLORE.searchTooShort,
  UNAUTHENTICATED: AUTH.loginRequired,
  NETWORK_ERROR: COMMON.networkError,
  INSUFFICIENT_INK: SHOP.insufficientInk,
  ALREADY_OWNED: SHOP.alreadyOwned,
  ALREADY_CLAIMED: SHOP.alreadyClaimed,
  CHALLENGE_NOT_DONE: SHOP.notDone,
  STICKER_NOT_OWNED: SHOP.notOwned,
};
