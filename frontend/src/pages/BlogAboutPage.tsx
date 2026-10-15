import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { getBlogAbout } from '../api/endpoints';
import { qk } from '../api/queries';

/** 예전 소개 주소(/blogs/:id/about)는 소개가 함께 보이는 블로그 첫 화면으로 보낸다 */
export function BlogAboutPage() {
  const { blogId = '' } = useParams();
  return <Navigate to={`/blogs/${blogId}`} replace />;
}

/** 블로그 첫 화면 위쪽 소개: 주인 이름 · 한 줄 소개 · 소개 글. 길면 접어 두고 "더보기"로 펼친다 (3.6) */
export function BlogIntro({ blogId, isOwner }: Readonly<{ blogId: string; isOwner: boolean }>) {
  const { data } = useQuery({ queryKey: qk.blogAbout(blogId), queryFn: () => getBlogAbout(blogId) });
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [data?.about, open]);

  if (!data) return null;
  if (!data.about && !data.ownerBio) {
    return isOwner ? (
      <p className="intro intro--empty muted">
        아직 소개 글이 없습니다. <Link to="/manage/settings">소개 글 쓰기</Link>
      </p>
    ) : null;
  }
  return (
    <section className="intro card" aria-label="소개">
      <h2 className="intro__name">{data.ownerNickname}</h2>
      {data.ownerBio && <p className="intro__bio">{data.ownerBio}</p>}
      {data.about && (
        <>
          <div ref={bodyRef} className={`intro__body${open ? ' is-open' : ''}`}>
            {data.about}
          </div>
          {(overflows || open) && (
            <button type="button" className="text-btn intro__more" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? '접기 ▴' : '더보기 ▾'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
