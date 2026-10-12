-- 구독: 마음에 드는 블로그의 새 글을 모아 본다. 회원마다 한 블로그에 하나. 회원이나 블로그가 지워지면 함께 지운다.
-- 내 블로그는 구독할 수 없다(서비스에서 막는다). 새 글 목록은 누구나 볼 수 있는 글만 보여 준다.
CREATE TABLE subscriptions (
    member_id  bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    blog_id    bigint      NOT NULL REFERENCES blogs (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (member_id, blog_id)
);
CREATE INDEX idx_subscriptions_blog ON subscriptions (blog_id);
