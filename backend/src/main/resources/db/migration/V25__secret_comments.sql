-- 비밀 댓글 (v1.11.0). 비밀 댓글은 쓴 사람과 그 글의 블로그 주인만 내용을 본다.
-- 비밀 댓글에 단 답글도 비밀이고, 원 댓글을 쓴 사람도 그 답글을 본다. 그 밖의 사람에게는 "비밀 댓글입니다"만 보인다.
-- 기존 댓글은 모두 공개(false)로 둔다. 컬럼을 더하기만 해서 블루-그린 배포 중 옛 서버도 그대로 돈다.
ALTER TABLE comments ADD COLUMN secret boolean NOT NULL DEFAULT false;
