-- 기본 다이어리 이름을 '미분류'에서 '일기장'으로. 이미 '일기장'이 있는 블로그는 건너뛴다.
UPDATE categories c SET name = '일기장', name_key = '일기장'
WHERE c.is_default AND c.name_key = '미분류'
  AND NOT EXISTS (SELECT 1 FROM categories o WHERE o.blog_id = c.blog_id AND o.name_key = '일기장');
