import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { search } from '../api/endpoints';
import { qk, useConfig } from '../api/queries';
import type { SearchResponse, SearchType } from '../api/types';
import { BlogCard, PostRow } from '../components/Cards';
import { Pagination } from '../components/Pagination';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TrendingList } from '../components/TrendingList';
import { validateQuery } from '../lib/validation';
import { EXPLORE } from '../messages';

const TYPES: { value: SearchType; label: string }[] = [
  { value: 'all', label: '모두' },
  { value: 'blog', label: '블로그' },
  { value: 'post', label: '글' },
];

function toType(v: string | null): SearchType {
  return v === 'blog' || v === 'post' ? v : 'all';
}

/** 통합 검색 결과: "검색 결과 N건", 블로그·글 구역 (3.8, CF-11; 커뮤니티 제외) */
export function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { limits } = useConfig();
  const rawQ = params.get('q') ?? '';
  const q = rawQ.trim();
  const type = toType(params.get('type'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const invalid = validateQuery(rawQ, limits.searchMin, limits.searchMax);

  const result = useQuery({
    queryKey: qk.search(q, type, page),
    queryFn: () => search({ q, type, page }),
    enabled: !invalid,
    placeholderData: (prev) => prev,
  });

  const setTypePage = (t: SearchType, p = 1) => {
    const next = new URLSearchParams({ q, type: t });
    if (p > 1) next.set('page', String(p));
    setParams(next);
  };

  return (
    <div className="with-aside">
      <div className="search-results">
        <SearchForm
          key={`${rawQ}|${type}`}
          initial={rawQ}
          type={type}
          maxLength={limits.searchMax}
          onSubmit={(nq, t) => setParams(new URLSearchParams({ q: nq, type: t }))}
        />
        {invalid ? (
          <Empty>{rawQ.trim() ? invalid : EXPLORE.searchStart}</Empty>
        ) : (
          <>
            <p className="search-summary">
              <b>‘{q}’</b> {TYPES.find((t) => t.value === type)?.label} · {result.data ? EXPLORE.searchTotal(result.data.total) : ''}
            </p>
            {result.isPending ? (
              <Loading />
            ) : result.error ? (
              <ErrorBox error={result.error} onRetry={() => void result.refetch()} />
            ) : (
              <Results data={result.data} type={type} onTypePage={setTypePage} q={q} />
            )}
          </>
        )}
      </div>
      <aside className="aside">
        <TrendingList className="card" onSelect={(k) => navigate(`/search?q=${encodeURIComponent(k)}&type=all`)} />
      </aside>
    </div>
  );
}

function Results({
  data,
  type,
  q,
  onTypePage,
}: {
  data: SearchResponse;
  type: SearchType;
  q: string;
  onTypePage: (t: SearchType, p?: number) => void;
}) {
  if (data.total === 0) return <Empty>{EXPLORE.searchNoResult}</Empty>;
  const showBlogs = type === 'all' || type === 'blog';
  const showPosts = type === 'all' || type === 'post';
  return (
    <>
      {showBlogs && (type === 'blog' || data.blogs.totalItems > 0) && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">
              블로그 <span className="muted">{data.blogs.totalItems}</span>
            </h2>
            {type === 'all' && data.blogs.totalPages > 1 && (
              <Link to={`/search?q=${encodeURIComponent(q)}&type=blog`} className="section__more">
                더 보기
              </Link>
            )}
          </div>
          {data.blogs.items.length === 0 ? (
            <Empty>{EXPLORE.searchNoResult}</Empty>
          ) : (
            <div className="card-grid card-grid--2">
              {data.blogs.items.map((b) => (
                <BlogCard key={b.id} blog={b} />
              ))}
            </div>
          )}
          {type === 'blog' && (
            <Pagination page={data.blogs.page} totalPages={data.blogs.totalPages} onChange={(p) => onTypePage('blog', p)} />
          )}
        </section>
      )}
      {showPosts && (type === 'post' || data.posts.totalItems > 0) && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">
              글 <span className="muted">{data.posts.totalItems}</span>
            </h2>
            {type === 'all' && data.posts.totalPages > 1 && (
              <Link to={`/search?q=${encodeURIComponent(q)}&type=post`} className="section__more">
                더 보기
              </Link>
            )}
          </div>
          {data.posts.items.length === 0 ? (
            <Empty>{EXPLORE.searchNoResult}</Empty>
          ) : (
            <div className="row-list">
              {data.posts.items.map((p) => (
                <PostRow key={p.id} post={p} />
              ))}
            </div>
          )}
          {type === 'post' && (
            <Pagination page={data.posts.page} totalPages={data.posts.totalPages} onChange={(p) => onTypePage('post', p)} />
          )}
        </section>
      )}
    </>
  );
}

/** 검색 범위 · 검색어 · 검색 버튼 (데모 검색 화면 맨 위) */
function SearchForm({
  initial,
  type,
  maxLength,
  onSubmit,
}: {
  initial: string;
  type: SearchType;
  maxLength: number;
  onSubmit: (q: string, type: SearchType) => void;
}) {
  const [value, setValue] = useState(initial);
  const [scope, setScope] = useState<SearchType>(type);
  return (
    <form
      className="search-form"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value.trim(), scope);
      }}
    >
      <div className="search-form__row">
        <select className="input select search-form__scope" aria-label="검색 범위" value={scope} onChange={(e) => setScope(toType(e.target.value))}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className="input search-form__q"
          type="search"
          aria-label="검색어"
          value={value}
          maxLength={maxLength + 20}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn btn--primary">
          검색
        </button>
      </div>
      <p className="search-form__hint">{EXPLORE.searchHint}</p>
    </form>
  );
}
