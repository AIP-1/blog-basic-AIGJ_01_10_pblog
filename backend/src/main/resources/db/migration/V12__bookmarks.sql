-- 책갈피: 다시 읽고 싶은 글을 저장해 둔다. 회원마다 한 글에 하나. 회원이나 글이 지워지면 함께 지운다.
-- 목록은 볼 수 있는 글만 보여 준다(글이 비공개로 바뀌면 숨는다).
CREATE TABLE bookmarks (
    member_id  bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    post_id    bigint      NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (member_id, post_id)
);
CREATE INDEX idx_bookmarks_member_created ON bookmarks (member_id, created_at DESC);
CREATE INDEX idx_bookmarks_post ON bookmarks (post_id);
