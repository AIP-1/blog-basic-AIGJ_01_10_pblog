import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { useConfig } from '../api/queries';
import { validateQuery } from '../lib/validation';
import { TrendingList } from './TrendingList';

/** 검색창. 누르면 입력 전에도 인기 검색어 10개 상자가 펼쳐진다 (3.8). */
export function SearchBox({ initialQuery = '' }: Readonly<{ initialQuery?: string }>) {
  const navigate = useNavigate();
  const { limits } = useConfig();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (q: string) => {
    setOpen(false);
    setHint(null);
    setValue(q);
    navigate(`/search?q=${encodeURIComponent(q)}&type=all`);
  };

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateQuery(value, limits.searchMin, limits.searchMax);
    if (err) {
      setHint(err);
      setOpen(true);
      return;
    }
    go(value.trim());
  };

  return (
    <div className="searchbox" ref={rootRef}>
      <form role="search" onSubmit={onSubmit} className="searchbox__form">
        <input
          type="search"
          className="searchbox__input"
          aria-label="검색어"
          placeholder="공개 글 검색"
          value={value}
          maxLength={limits.searchMax + 20}
          onChange={(e) => {
            setValue(e.target.value);
            setHint(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        <button type="submit" className="searchbox__submit" aria-label="검색">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </form>
      {open && (
        <div className="searchbox__dropdown">
          {hint && (
            <p className="searchbox__hint" role="alert">
              {hint}
            </p>
          )}
          <TrendingList onSelect={go} />
        </div>
      )}
    </div>
  );
}
