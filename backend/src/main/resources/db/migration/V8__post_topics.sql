-- 글마다 분야(주제)를 고른다 (데모 글쓰기의 "분야"). 지금까지는 블로그의 주제를 글이 따라갔다.
-- 이미 있는 글은 블로그의 주제로 채운다. 홈의 주제 탭·주제 화면은 이제 글의 분야로 고른다.
-- 임시저장 글은 분야가 비어 있어도 된다.
ALTER TABLE posts ADD COLUMN topic_id bigint REFERENCES topics (id);
UPDATE posts p SET topic_id = b.topic_id FROM blogs b WHERE b.id = p.blog_id;
ALTER TABLE posts ALTER COLUMN topic_id SET NOT NULL;
CREATE INDEX idx_posts_topic_created ON posts (topic_id, created_at DESC);

ALTER TABLE drafts ADD COLUMN topic_id bigint REFERENCES topics (id) ON DELETE SET NULL;
