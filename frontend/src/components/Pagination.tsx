interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** 한 번에 보여 줄 번호 개수 */
  window?: number;
}

/** `‹ 1 2 ›` — 현재 페이지 강조, 처음·끝에서 이전/다음 비활성 (CF-10-3) */
export function Pagination({ page, totalPages, onChange, window = 10 }: Readonly<PaginationProps>) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, page), totalPages);
  const start = Math.floor((current - 1) / window) * window + 1;
  const end = Math.min(totalPages, start + window - 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <nav className="pagination" aria-label="페이지">
      <button
        type="button"
        className="pagination__btn"
        aria-label="이전 페이지"
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`pagination__btn${p === current ? ' is-current' : ''}`}
          aria-current={p === current ? 'page' : undefined}
          onClick={() => p !== current && onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="pagination__btn"
        aria-label="다음 페이지"
        disabled={current >= totalPages}
        onClick={() => onChange(current + 1)}
      >
        ›
      </button>
    </nav>
  );
}
