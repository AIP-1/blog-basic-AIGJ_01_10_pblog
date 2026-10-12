import type { ReactNode } from 'react';

/** 분야 탭의 선 아이콘. 글자색(currentColor) 한 가지로 그려서 고른 탭은 강조색이 된다 */
const PATHS: Record<string, ReactNode> = {
  all: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  daily: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  travel: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  food: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>
  ),
  hobby: (
    <>
      <path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3c.6.7.2 3.2-2.5 3.2Z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="10.5" cy="7" r="1" />
      <circle cx="15.5" cy="7.5" r="1" />
    </>
  ),
  exercise: (
    <>
      <rect x="4" y="7" width="3.5" height="10" rx="1" />
      <rect x="16.5" y="7" width="3.5" height="10" rx="1" />
      <path d="M7.5 12h9M2 10v4M22 10v4" />
    </>
  ),
  game: (
    <>
      <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
      <path d="M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.2 2.2L9 15h6l1.8 2.2A3 3 0 0 0 22 15l-.7-6.4A4 4 0 0 0 17.3 5Z" />
    </>
  ),
  culture: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5" />
    </>
  ),
  study: <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2ZM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z" />,
  money: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20M16 15h2" />
    </>
  ),
  other: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
};

export function TopicIcon({ code }: { code: string }) {
  return (
    <svg
      className="topic-tabs__icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[code] ?? PATHS.other}
    </svg>
  );
}
