-- 분야를 9개로 정한다: 일상·여행·음식·취미·운동·게임·문화·공부·경제.
-- 게임·경제는 새로 넣고(경제는 예전 경제·재테크 코드를 다시 쓴다), 문화는 새로 넣는다.
-- 빠지는 분야를 쓰던 글과 블로그는 개발→공부, 책·영화·드라마→문화, 기타→일상으로 옮긴다. 임시저장 글은 분야를 비운다.
INSERT INTO topics (code, name, description, sort_order) VALUES
    ('game',    '게임', '즐긴 게임 이야기', 0),
    ('culture', '문화', '책, 영화, 드라마, 음악, 전시', 0),
    ('money',   '경제', '돈 관리와 경제 이야기', 0)
ON CONFLICT (code) DO NOTHING;

UPDATE posts SET topic_id = (SELECT id FROM topics WHERE code = 'study') WHERE topic_id = (SELECT id FROM topics WHERE code = 'dev');
UPDATE posts SET topic_id = (SELECT id FROM topics WHERE code = 'culture')
WHERE topic_id IN (SELECT id FROM topics WHERE code IN ('book', 'movie'));
UPDATE posts SET topic_id = (SELECT id FROM topics WHERE code = 'daily') WHERE topic_id = (SELECT id FROM topics WHERE code = 'etc');
UPDATE blogs SET topic_id = (SELECT id FROM topics WHERE code = 'study') WHERE topic_id = (SELECT id FROM topics WHERE code = 'dev');
UPDATE blogs SET topic_id = (SELECT id FROM topics WHERE code = 'culture')
WHERE topic_id IN (SELECT id FROM topics WHERE code IN ('book', 'movie'));
UPDATE blogs SET topic_id = (SELECT id FROM topics WHERE code = 'daily') WHERE topic_id = (SELECT id FROM topics WHERE code = 'etc');
UPDATE drafts SET topic_id = NULL WHERE topic_id IN (SELECT id FROM topics WHERE code IN ('dev', 'book', 'movie', 'etc'));
DELETE FROM topics WHERE code IN ('dev', 'book', 'movie', 'etc');

UPDATE topics SET sort_order = o.n
FROM (VALUES ('daily', 1), ('travel', 2), ('food', 3), ('hobby', 4), ('exercise', 5), ('game', 6), ('culture', 7),
             ('study', 8), ('money', 9)) AS o (code, n)
WHERE topics.code = o.code;
