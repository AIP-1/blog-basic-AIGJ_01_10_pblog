-- 분야를 10개로 줄인다: 일상·여행·음식·취미·운동·개발·책·영화·드라마·공부·기타.
-- 빠지는 분야를 쓰던 글과 블로그는 "기타"로 옮기고, 임시저장 글은 분야를 비운다.
UPDATE posts SET topic_id = (SELECT id FROM topics WHERE code = 'etc')
WHERE topic_id IN (SELECT id FROM topics WHERE code IN ('music', 'game', 'pet', 'career', 'money', 'fashion', 'home', 'photo', 'parent'));
UPDATE blogs SET topic_id = (SELECT id FROM topics WHERE code = 'etc')
WHERE topic_id IN (SELECT id FROM topics WHERE code IN ('music', 'game', 'pet', 'career', 'money', 'fashion', 'home', 'photo', 'parent'));
UPDATE drafts SET topic_id = NULL
WHERE topic_id IN (SELECT id FROM topics WHERE code IN ('music', 'game', 'pet', 'career', 'money', 'fashion', 'home', 'photo', 'parent'));
DELETE FROM topics WHERE code IN ('music', 'game', 'pet', 'career', 'money', 'fashion', 'home', 'photo', 'parent');

UPDATE topics SET sort_order = o.n
FROM (VALUES ('daily', 1), ('travel', 2), ('food', 3), ('hobby', 4), ('exercise', 5), ('dev', 6), ('book', 7),
             ('movie', 8), ('study', 9), ('etc', 10)) AS o (code, n)
WHERE topics.code = o.code;
