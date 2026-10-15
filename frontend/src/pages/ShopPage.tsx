import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import { useMe } from '../api/queries';
import {
  buyPack,
  claimChallenge,
  getChallenges,
  getMyStickers,
  getPacks,
  shopKeys,
  useInk,
  type Challenge,
  type InkWallet,
  type StickerPack,
} from '../api/shop';
import { useAuth } from '../auth/context';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { InkIcon, StickerImg } from '../components/Sticker';
import { useToast } from '../components/toastContext';
import { formatRelative } from '../lib/format';
import { SHOP } from '../messages';

type Tab = 'shop' | 'mine' | 'challenges';
const TABS: Tab[] = ['shop', 'mine', 'challenges'];

/** 스티커 상점: 상점(팩) · 내 스티커 · 도전과제 탭 + 오른쪽 잉크 잔액·모으는 법·내역. 보기는 누구나, 사기는 로그인 */
export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'shop';
  const { data: me } = useMe();
  const ink = useInk(!!me).data;

  return (
    <div className="shop">
      <header className="page-head">
        <h1 className="page-head__title">{SHOP.title}</h1>
        <p className="page-head__desc">{SHOP.desc}</p>
      </header>
      <div className="shop__layout">
        <div className="shop__main">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`tabs__tab${tab === t ? ' is-active' : ''}`}
                onClick={() => setParams(t === 'shop' ? {} : { tab: t }, { replace: true })}
              >
                {SHOP.tabs[t]}
              </button>
            ))}
          </div>
          {tab === 'shop' && <PacksTab loggedIn={!!me} balance={ink?.balance ?? 0} />}
          {tab === 'mine' && <MineTab loggedIn={!!me} />}
          {tab === 'challenges' && <ChallengesTab loggedIn={!!me} />}
        </div>
        <InkPanel wallet={ink} loggedIn={!!me} />
      </div>
    </div>
  );
}

/** 오른쪽: 잔액 · 연속 출석 · 잉크 모으는 법(오늘 받은 횟수) · 최근 내역 */
function InkPanel({ wallet, loggedIn }: Readonly<{ wallet: InkWallet | undefined; loggedIn: boolean }>) {
  const { openLogin } = useAuth();
  const earn = wallet?.earn;
  let historyContent: ReactNode;
  if (!wallet) {
    historyContent = <Loading />;
  } else if (wallet.history.length === 0) {
    historyContent = <p className="muted ink-history__empty">{SHOP.historyEmpty}</p>;
  } else {
    historyContent = (
      <ul>
        {wallet.history.map((e) => (
          <li key={e.id}>
            <span className="ink-history__what">
              {SHOP.reasons[e.reason]}
              {e.label && <span className="muted"> · {e.label}</span>}
              <small className="muted">{formatRelative(e.createdAt)}</small>
            </span>
            <b className={e.amount > 0 ? 'ink-plus' : 'ink-minus'}>
              {e.amount > 0 ? `+${e.amount}` : e.amount}
            </b>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <aside className="shop__side">
      <section className="box ink-box">
        <h2 className="box-title">{SHOP.ink}</h2>
        {loggedIn ? (
          <>
            <p className="ink-box__balance">
              <InkIcon size={22} />
              <b>{(wallet?.balance ?? 0).toLocaleString()}</b>
            </p>
            {wallet && (
              <p className="ink-box__chips">
                {wallet.checkedInToday && <span className="chip chip--ok">{SHOP.checkedIn}</span>}
                {wallet.streak > 0 && <span className="chip">{SHOP.streak(wallet.streak)}</span>}
              </p>
            )}
          </>
        ) : (
          <button type="button" className="btn btn--primary btn--block" onClick={() => openLogin()}>
            {SHOP.needLogin}
          </button>
        )}
        <h3 className="ink-box__sub">{SHOP.howTitle}</h3>
        <ul className="ink-rules">
          <li>
            <span>{SHOP.howCheckin(earn?.checkin ?? 10)}</span>
            {wallet && <span className="muted">{SHOP.today(wallet.checkedInToday ? 1 : 0, 1)}</span>}
          </li>
          <li>
            <span>{SHOP.howPost(earn?.post ?? 20, earn?.postDailyMax ?? 3)}</span>
            {earn && <span className="muted">{SHOP.today(Math.min(earn.postsToday, earn.postDailyMax), earn.postDailyMax)}</span>}
          </li>
          <li>
            <span>{SHOP.howComment(earn?.comment ?? 2, earn?.commentDailyMax ?? 10)}</span>
            {earn && (
              <span className="muted">{SHOP.today(Math.min(earn.commentsToday, earn.commentDailyMax), earn.commentDailyMax)}</span>
            )}
          </li>
        </ul>
      </section>
      {loggedIn && (
        <section className="box ink-history">
          <h2 className="box-title">{SHOP.historyTitle}</h2>
          {historyContent}
        </section>
      )}
    </aside>
  );
}

function PacksTab({ loggedIn, balance }: Readonly<{ loggedIn: boolean; balance: number }>) {
  const packsQ = useQuery({ queryKey: shopKeys.packs, queryFn: getPacks });
  const challengesQ = useQuery({ queryKey: shopKeys.challenges, queryFn: getChallenges });
  const limited = (challengesQ.data ?? []).flatMap((c) => (c.rewardSticker ? [{ ...c.rewardSticker, from: c.title }] : []));

  if (packsQ.isPending) return <Loading />;
  if (packsQ.error) return <ErrorBox error={packsQ.error} onRetry={() => void packsQ.refetch()} />;
  return (
    <>
      <div className="pack-grid">
        {packsQ.data.map((p) => (
          <PackCard key={p.code} pack={p} loggedIn={loggedIn} balance={balance} />
        ))}
      </div>
      {limited.length > 0 && (
        <section className="limited">
          <h2 className="section__title">
            {SHOP.limited} <span className="muted limited__hint">{SHOP.limitedHint}</span>
          </h2>
          <ul className="limited__list">
            {limited.map((s) => (
              <li key={s.code} title={`${s.name} — ${s.from}`}>
                <StickerImg code={s.code} name={s.name} size={56} />
                <span>{s.name}</span>
                <small className="muted">{s.from}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function PackCard({ pack, loggedIn, balance }: Readonly<{ pack: StickerPack; loggedIn: boolean; balance: number }>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { openLogin } = useAuth();
  const buy = useMutation({
    mutationFn: () => buyPack(pack.code),
    onSuccess: () => {
      toast.show(SHOP.bought(pack.name));
      void queryClient.invalidateQueries({ queryKey: shopKeys.all });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });
  const short = pack.price - balance;

  const onBuy = () => {
    if (!loggedIn) {
      openLogin();
      return;
    }
    if (window.confirm(SHOP.buyConfirm(pack.name, pack.price))) buy.mutate();
  };

  return (
    <article className={`pack${pack.owned ? ' is-owned' : ''}`}>
      <header className="pack__head">
        <h3 className="pack__name">{pack.name}</h3>
        <span className="ink-amount">
          <InkIcon />
          {pack.price}
        </span>
      </header>
      <p className="pack__desc">{pack.description}</p>
      <ul className="pack__stickers">
        {pack.stickers.map((s) => (
          <li key={s.code} title={s.name}>
            <StickerImg code={s.code} name={s.name} size={52} />
          </li>
        ))}
      </ul>
      <footer className="pack__foot">
        {pack.owned ? (
          <span className="pack__owned">✓ {SHOP.owned}</span>
        ) : (
          <>
            {loggedIn && short > 0 && <span className="muted pack__short">{SHOP.notEnough(short)}</span>}
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={onBuy}
              disabled={buy.isPending || (loggedIn && short > 0)}
            >
              {SHOP.buy}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

function MineTab({ loggedIn }: Readonly<{ loggedIn: boolean }>) {
  const q = useQuery({ queryKey: shopKeys.mine, queryFn: getMyStickers, enabled: loggedIn });
  if (!loggedIn) return <Empty>{SHOP.mineLoggedOut}</Empty>;
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  if (q.data.length === 0) {
    return (
      <Empty>
        {SHOP.mineEmpty}
        <br />
        <Link to="/shop">{SHOP.coverGoShop}</Link>
      </Empty>
    );
  }
  return (
    <ul className="my-stickers">
      {q.data.map((s) => (
        <li key={s.code}>
          <StickerImg code={s.code} name={s.name} size={64} />
          <b>{s.name}</b>
          {s.limited ? <span className="badge badge--limited">{SHOP.limited}</span> : <small className="muted">{s.packName}</small>}
        </li>
      ))}
    </ul>
  );
}

function ChallengesTab({ loggedIn }: Readonly<{ loggedIn: boolean }>) {
  const q = useQuery({ queryKey: shopKeys.challenges, queryFn: getChallenges });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <ul className="challenges">
      {q.data.map((c) => (
        <ChallengeRow key={c.code} challenge={c} loggedIn={loggedIn} />
      ))}
    </ul>
  );
}

function ChallengeRow({ challenge: c, loggedIn }: Readonly<{ challenge: Challenge; loggedIn: boolean }>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const claim = useMutation({
    mutationFn: () => claimChallenge(c.code),
    onSuccess: (res) => {
      if (res.sticker) toast.show(SHOP.claimedSticker(res.sticker.name));
      void queryClient.invalidateQueries({ queryKey: shopKeys.all });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });
  const pct = Math.round((c.progress / c.goal) * 100);
  let stateClass = '';
  if (c.claimed) stateClass = ' is-claimed';
  else if (c.completed) stateClass = ' is-done';
  let action: ReactNode;
  if (c.claimed) {
    action = <span className="challenge__state challenge__state--ok">✓ {SHOP.claimed}</span>;
  } else if (c.completed && loggedIn) {
    action = (
      <button type="button" className="btn btn--sm btn--primary" disabled={claim.isPending} onClick={() => claim.mutate()}>
        {SHOP.claim}
      </button>
    );
  } else {
    action = <span className="challenge__state">{SHOP.inProgress}</span>;
  }

  return (
    <li className={`challenge${stateClass}`}>
      <div className="challenge__badge" aria-hidden="true">
        {c.rewardSticker ? <StickerImg code={c.rewardSticker.code} size={44} /> : <InkIcon size={26} />}
      </div>
      <div className="challenge__body">
        <div className="challenge__title">
          <b>{c.title}</b>
          <span className="challenge__reward">
            <InkIcon size={12} />+{c.rewardInk}
            {c.rewardSticker && <span className="muted"> · {c.rewardSticker.name}</span>}
          </span>
        </div>
        <p className="challenge__desc">{c.description}</p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={c.goal} aria-valuenow={c.progress} aria-label={c.title}>
          <span className="progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <span className="challenge__count">
          {c.progress}/{c.goal}
        </span>
      </div>
      <div className="challenge__action">
        {action}
      </div>
    </li>
  );
}
