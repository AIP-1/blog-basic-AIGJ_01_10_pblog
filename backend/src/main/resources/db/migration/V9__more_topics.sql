-- 분야를 늘린다. 이미 있는 다섯 개(여행·음식·취미·운동·개발)는 코드를 그대로 두고 순서만 다시 매긴다.
INSERT INTO topics (code, name, description, sort_order) VALUES
    ('daily',   '일상',      '평범한 하루의 기록', 0),
    ('book',    '책',        '읽은 책과 밑줄 그은 문장', 0),
    ('movie',   '영화·드라마', '본 것과 느낀 것', 0),
    ('music',   '음악',      '듣는 음악, 하는 음악', 0),
    ('game',    '게임',      '즐긴 게임 이야기', 0),
    ('pet',     '반려동물',   '함께 사는 동물 이야기', 0),
    ('study',   '공부',      '배우는 과정과 시험 준비', 0),
    ('career',  '취업·직장',  '일과 커리어 이야기', 0),
    ('money',   '경제·재테크', '돈 관리와 경제 이야기', 0),
    ('fashion', '패션·뷰티',  '옷, 화장, 꾸미기', 0),
    ('home',    '인테리어',   '집과 공간 꾸미기', 0),
    ('photo',   '사진',      '찍은 사진과 찍는 법', 0),
    ('parent',  '육아',      '아이와 함께하는 날들', 0),
    ('etc',     '기타',      '어디에도 딱 맞지 않는 이야기', 0);

UPDATE topics SET sort_order = o.n
FROM (VALUES ('daily', 1), ('travel', 2), ('food', 3), ('hobby', 4), ('exercise', 5), ('dev', 6), ('book', 7),
             ('movie', 8), ('music', 9), ('game', 10), ('pet', 11), ('study', 12), ('career', 13), ('money', 14),
             ('fashion', 15), ('home', 16), ('photo', 17), ('parent', 18), ('etc', 19)) AS o (code, n)
WHERE topics.code = o.code;
