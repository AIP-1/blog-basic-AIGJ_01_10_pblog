import { Link } from 'react-router';
import { COMMON } from '../messages';

/** 화면 안에서 보여 주는 "존재하지 않는 …입니다" (별도 오류 화면이 아님) */
export function NotFound({ what }: Readonly<{ what: string }>) {
  return (
    <div className="notfound" role="status">
      <p className="notfound__msg">{COMMON.notFound(what)}</p>
      <Link to="/" className="btn btn--ghost">
        홈으로
      </Link>
    </div>
  );
}
