-- 스티커 상점: 활동으로 '잉크'를 모아 스티커 팩을 사고, 도전과제를 깨면 한정 스티커를 받는다.
-- 산 스티커는 다이어리 표지에 붙인다(다이어리마다 3개까지, 서비스에서 막는다).

-- 잉크 지갑: 회원마다 한 줄. 잔액은 음수가 될 수 없다(차감은 balance >= 값 조건으로만 한다).
CREATE TABLE ink_wallets (
    member_id  bigint      PRIMARY KEY REFERENCES members (id) ON DELETE CASCADE,
    balance    int         NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL,
    CONSTRAINT ck_ink_wallets_balance CHECK (balance >= 0)
);

-- 잉크 내역: 모든 증감을 남긴다. 같은 이유·같은 대상으로는 한 번만 쌓인다(출석은 날짜, 글·댓글은 번호, 도전과제는 코드).
-- 글·댓글을 지워도 내역은 남으므로, 지우고 다시 써서 하루 한도를 넘길 수 없다.
CREATE TABLE ink_ledger_entries (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id  bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    amount     int         NOT NULL,
    reason     varchar(20) NOT NULL,
    ref        varchar(60) NOT NULL,
    earned_on  date        NOT NULL, -- 한국 시간 기준 날짜 (하루 한도·연속 출석 계산)
    created_at timestamptz NOT NULL,
    CONSTRAINT ck_ink_ledger_entries_amount CHECK (amount <> 0),
    CONSTRAINT ck_ink_ledger_entries_reason CHECK (reason IN ('CHECKIN', 'POST', 'COMMENT', 'CHALLENGE', 'PURCHASE')),
    CONSTRAINT uk_ink_ledger_entries_member_reason_ref UNIQUE (member_id, reason, ref)
);
CREATE INDEX idx_ink_ledger_entries_member_day ON ink_ledger_entries (member_id, reason, earned_on);
CREATE INDEX idx_ink_ledger_entries_member_id ON ink_ledger_entries (member_id, id DESC);

-- 스티커 팩: 팩 단위로 판다
CREATE TABLE sticker_packs (
    code        varchar(30)  PRIMARY KEY,
    name        varchar(20)  NOT NULL,
    description varchar(100) NOT NULL,
    price       int          NOT NULL,
    sort_order  int          NOT NULL,
    CONSTRAINT ck_sticker_packs_price CHECK (price > 0)
);

-- 스티커: 그림은 프론트엔드 public/stickers/<code>.svg. 한정(limited) 스티커는 팩에 없고 도전과제로만 받는다.
CREATE TABLE stickers (
    code       varchar(30) PRIMARY KEY,
    pack_code  varchar(30) REFERENCES sticker_packs (code),
    name       varchar(20) NOT NULL,
    limited    boolean     NOT NULL DEFAULT false,
    sort_order int         NOT NULL,
    CONSTRAINT ck_stickers_limited_no_pack CHECK ((limited AND pack_code IS NULL) OR (NOT limited AND pack_code IS NOT NULL))
);
CREATE INDEX idx_stickers_pack_code ON stickers (pack_code);

-- 산 팩: 같은 팩은 한 번만 산다
CREATE TABLE member_sticker_packs (
    member_id    bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    pack_code    varchar(30) NOT NULL REFERENCES sticker_packs (code),
    purchased_at timestamptz NOT NULL,
    PRIMARY KEY (member_id, pack_code)
);

-- 가진 스티커: 회원마다 한 스티커에 하나
CREATE TABLE member_stickers (
    member_id    bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    sticker_code varchar(30) NOT NULL REFERENCES stickers (code),
    acquired_at  timestamptz NOT NULL,
    PRIMARY KEY (member_id, sticker_code)
);

-- 도전과제: 진행도는 기존 기록(글·댓글·좋아요·다이어리·구독·책갈피·출석)에서 코드마다 계산한다
CREATE TABLE challenges (
    code           varchar(30)  PRIMARY KEY,
    title          varchar(30)  NOT NULL,
    description    varchar(100) NOT NULL,
    goal           int          NOT NULL,
    reward_ink     int          NOT NULL,
    reward_sticker varchar(30) REFERENCES stickers (code),
    sort_order     int          NOT NULL,
    CONSTRAINT ck_challenges_goal CHECK (goal > 0),
    CONSTRAINT ck_challenges_reward_ink CHECK (reward_ink >= 0)
);

-- 받은 보상: 도전과제마다 한 번만
CREATE TABLE member_challenges (
    member_id      bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    challenge_code varchar(30) NOT NULL REFERENCES challenges (code),
    claimed_at     timestamptz NOT NULL,
    PRIMARY KEY (member_id, challenge_code)
);

-- 다이어리 표지 스티커: 자리(좌상·우상·좌하·우하·가운데)마다 하나, 살짝 기울일 수 있다
CREATE TABLE diary_stickers (
    category_id  bigint      NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    slot         varchar(2)  NOT NULL,
    sticker_code varchar(30) NOT NULL REFERENCES stickers (code),
    rotation     int         NOT NULL DEFAULT 0,
    PRIMARY KEY (category_id, slot),
    CONSTRAINT ck_diary_stickers_slot CHECK (slot IN ('TL', 'TR', 'BL', 'BR', 'C')),
    CONSTRAINT ck_diary_stickers_rotation CHECK (rotation IN (-15, -8, 0, 8, 15))
);

INSERT INTO sticker_packs (code, name, description, price, sort_order) VALUES
    ('daily',      '일상', '머그잔부터 우산까지, 평범한 하루의 조각들', 60, 1),
    ('food',       '음식', '먹는 기록에 붙이면 딱 좋은 맛있는 것들', 80, 2),
    ('travel',     '여행', '가방을 싸고 떠나는 날의 설렘', 120, 3),
    ('season',     '계절', '봄 벚꽃에서 겨울 눈사람까지 사계절', 100, 4),
    ('animal',     '동물', '보기만 해도 웃음이 나는 동물 친구들', 150, 5),
    ('stationery', '문구', '다이어리 꾸미기의 기본, 문구 모음', 50, 6);

INSERT INTO stickers (code, pack_code, name, limited, sort_order) VALUES
    ('daily-mug',       'daily', '머그잔', false, 1),
    ('daily-plant',     'daily', '화분', false, 2),
    ('daily-clock',     'daily', '자명종', false, 3),
    ('daily-house',     'daily', '우리 집', false, 4),
    ('daily-umbrella',  'daily', '우산', false, 5),
    ('daily-sock',      'daily', '양말', false, 6),
    ('food-onigiri',    'food', '삼각김밥', false, 1),
    ('food-strawberry', 'food', '딸기', false, 2),
    ('food-cupcake',    'food', '컵케이크', false, 3),
    ('food-egg',        'food', '달걀프라이', false, 4),
    ('food-toast',      'food', '토스트', false, 5),
    ('food-icecream',   'food', '아이스크림', false, 6),
    ('travel-suitcase', 'travel', '여행 가방', false, 1),
    ('travel-plane',    'travel', '비행기', false, 2),
    ('travel-camera',   'travel', '카메라', false, 3),
    ('travel-pin',      'travel', '지도 핀', false, 4),
    ('travel-ticket',   'travel', '승차권', false, 5),
    ('travel-balloon',  'travel', '열기구', false, 6),
    ('season-blossom',  'season', '벚꽃', false, 1),
    ('season-sun',      'season', '여름 해', false, 2),
    ('season-maple',    'season', '단풍잎', false, 3),
    ('season-snowman',  'season', '눈사람', false, 4),
    ('season-snow',     'season', '눈송이', false, 5),
    ('season-rain',     'season', '비구름', false, 6),
    ('animal-cat',      'animal', '고양이', false, 1),
    ('animal-dog',      'animal', '강아지', false, 2),
    ('animal-bunny',    'animal', '토끼', false, 3),
    ('animal-bear',     'animal', '곰', false, 4),
    ('animal-chick',    'animal', '병아리', false, 5),
    ('animal-whale',    'animal', '고래', false, 6),
    ('stat-pencil',     'stationery', '연필', false, 1),
    ('stat-notebook',   'stationery', '공책', false, 2),
    ('stat-clip',       'stationery', '클립', false, 3),
    ('stat-tape',       'stationery', '마스킹 테이프', false, 4),
    ('stat-eraser',     'stationery', '지우개', false, 5),
    ('stat-ruler',      'stationery', '자', false, 6),
    ('ltd-first-star',  NULL, '첫 별', true, 1),
    ('ltd-golden-pen',  NULL, '금빛 만년필', true, 2),
    ('ltd-clover',      NULL, '네잎클로버', true, 3),
    ('ltd-heart-letter', NULL, '하트 편지', true, 4),
    ('ltd-rainbow',     NULL, '무지개', true, 5),
    ('ltd-crown',       NULL, '개근 왕관', true, 6);

INSERT INTO challenges (code, title, description, goal, reward_ink, reward_sticker, sort_order) VALUES
    ('first-post',      '첫 글 쓰기', '내 블로그에 첫 글을 올려 보세요', 1, 30, 'ltd-first-star', 1),
    ('posts-10',        '글 10개', '글을 10개 써 보세요', 10, 100, 'ltd-golden-pen', 2),
    ('streak-7',        '7일 연속 출석', '7일 동안 하루도 빠짐없이 들러 보세요', 7, 70, 'ltd-clover', 3),
    ('comments-10',     '댓글 10개 달기', '다른 사람 글에 댓글을 10개 달아 보세요', 10, 50, NULL, 4),
    ('likes-50',        '좋아요 50개 받기', '내 글이 받은 좋아요가 50개가 되면 완료', 50, 100, 'ltd-heart-letter', 5),
    ('diaries-3',       '다이어리 3권 만들기', '미분류 말고 다이어리를 3권 만들어 보세요', 3, 30, 'ltd-rainbow', 6),
    ('first-subscribe', '첫 구독', '마음에 드는 블로그를 구독해 보세요', 1, 20, NULL, 7),
    ('first-bookmark',  '첫 책갈피', '다시 읽고 싶은 글에 책갈피를 꽂아 보세요', 1, 20, NULL, 8),
    ('bio',             '프로필 소개 쓰기', '내 정보에서 한 줄 소개를 써 보세요', 1, 20, NULL, 9),
    ('checkin-30',      '30일 출석', '출석한 날이 30일이 되면 완료 (연속 아니어도 돼요)', 30, 150, 'ltd-crown', 10);
