import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AD_INTERVAL_MS, ADS } from '../lib/ads';

/** 메인 맨 위 광고 슬라이드: 5초마다 넘어가고, 마우스를 올리거나 초점이 있으면 멈춘다. 휴대폰은 밀어서 넘긴다 */
export function AdSlider() {
  const [cur, setCur] = useState(0);
  const paused = useRef(false);
  const touchX = useRef<number | null>(null);
  const n = ADS.length;
  const go = (i: number) => setCur(((i % n) + n) % n);

  useEffect(() => {
    if (n < 2) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      if (!paused.current) setCur((c) => (c + 1) % n);
    }, AD_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [n]);

  if (n === 0) return null;
  return (
    <section
      className="ad-slider"
      aria-roledescription="carousel"
      aria-label="광고"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        paused.current = true;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? 0);
        paused.current = false;
        if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="ad-track" style={{ transform: `translateX(-${cur * 100}%)` }}>
        {ADS.map((a, i) => (
          <Link
            key={a.title}
            className="ad-slide"
            to={a.href}
            style={{ ['--ad-bg' as string]: a.bg, ['--ad-fg' as string]: a.fg }}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${n}`}
            tabIndex={i === cur ? 0 : -1}
          >
            <span className="ad-copy">
              <span className="ad-kicker">{a.kicker}</span>
              <b className="ad-title">{a.title}</b>
              <span className="ad-text">{a.text}</span>
            </span>
            {a.image && <img className="ad-img" src={a.image} alt="" />}
          </Link>
        ))}
      </div>
      <span className="ad-label">AD</span>
      {n > 1 && (
        <>
          <button type="button" className="ad-arrow ad-arrow--prev" aria-label="이전 광고" onClick={() => go(cur - 1)}>
            ‹
          </button>
          <button type="button" className="ad-arrow ad-arrow--next" aria-label="다음 광고" onClick={() => go(cur + 1)}>
            ›
          </button>
          <div className="ad-dots">
            {ADS.map((a, i) => (
              <button
                key={a.title}
                type="button"
                aria-label={`${i + 1}번 광고`}
                className={i === cur ? 'is-on' : ''}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
