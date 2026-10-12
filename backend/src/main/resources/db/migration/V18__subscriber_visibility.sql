-- 공개 범위에 '구독자만'(일부공개, SUBSCRIBERS)을 더한다. 글·다이어리·임시저장 모두.
-- 구독자 = 그 블로그나 그 다이어리를 구독한 사람. 구독자만 글·다이어리는 구독자와 주인만 보고,
-- 메인·검색·인기·주제 화면에는 나오지 않는다(누구나 볼 수 있는 글만 나온다).
ALTER TABLE posts ALTER COLUMN visibility TYPE varchar(12);
ALTER TABLE posts DROP CONSTRAINT ck_posts_visibility;
ALTER TABLE posts ADD CONSTRAINT ck_posts_visibility CHECK (visibility IN ('PUBLIC', 'SUBSCRIBERS', 'PRIVATE'));

ALTER TABLE drafts ALTER COLUMN visibility TYPE varchar(12);
ALTER TABLE drafts DROP CONSTRAINT ck_drafts_visibility;
ALTER TABLE drafts ADD CONSTRAINT ck_drafts_visibility CHECK (visibility IN ('PUBLIC', 'SUBSCRIBERS', 'PRIVATE'));

ALTER TABLE categories ALTER COLUMN visibility TYPE varchar(12);
ALTER TABLE categories DROP CONSTRAINT ck_categories_visibility;
ALTER TABLE categories ADD CONSTRAINT ck_categories_visibility CHECK (visibility IN ('PUBLIC', 'SUBSCRIBERS', 'PRIVATE'));
-- 공개가 아닌 다이어리(구독자만·비공개)는 적어서 부분 인덱스로 그 목록을 바로 찾는다 (공개 글 조건에서 매번 쓴다)
DROP INDEX idx_categories_private;
CREATE INDEX idx_categories_not_public ON categories (id) WHERE visibility <> 'PUBLIC';
