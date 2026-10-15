import { Link } from 'react-router';

export function TagList({ tags }: Readonly<{ tags: string[] }>) {
  if (tags.length === 0) return null;
  return (
    <ul className="tag-list" aria-label="태그">
      {tags.map((t) => (
        <li key={t}>
          <Link to={`/tags/${encodeURIComponent(t)}`} className="tag">
            #{t}
          </Link>
        </li>
      ))}
    </ul>
  );
}
