-- 다이어리 구독: 블로그 전체가 아니라 다이어리 한 권만 구독한다 (데모 '+ 다이어리 구독'). 회원마다 한 다이어리에 하나.
-- 회원이나 다이어리가 지워지면 함께 지운다. 내 다이어리와 비공개 다이어리는 구독할 수 없고(서비스에서 막는다),
-- 다이어리를 비공개로 바꾸면 그 다이어리의 구독은 지운다.
CREATE TABLE diary_subscriptions (
    member_id   bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    category_id bigint      NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL,
    PRIMARY KEY (member_id, category_id)
);
CREATE INDEX idx_diary_subscriptions_category ON diary_subscriptions (category_id);
