-- 책갈피 폴더 (데모 '저장' 폴더 분류): 책갈피를 폴더별로 나눠 둔다. 폴더는 회원마다 따로이고 이름이 겹치면 안 된다.
-- 책갈피의 folder_id가 비어 있으면 '미분류'. 폴더를 지우면 안의 책갈피는 미분류로 돌아간다(글은 그대로).
-- V14·V15는 다른 작업(구독)이 쓸 자리라 비워 둔다.
CREATE TABLE bookmark_folders (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    member_id  bigint      NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    name       varchar(20) NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT uk_bookmark_folders_member_name UNIQUE (member_id, name)
);

ALTER TABLE bookmarks ADD COLUMN folder_id bigint REFERENCES bookmark_folders (id) ON DELETE SET NULL;
CREATE INDEX idx_bookmarks_folder ON bookmarks (folder_id);
