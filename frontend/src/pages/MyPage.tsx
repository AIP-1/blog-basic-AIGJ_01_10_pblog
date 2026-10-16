import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage, isApiError } from "../api/client";
import {
  changePassword,
  getMyProfile,
  updateMyProfile,
  withdraw,
  withdrawBySocial,
} from "../api/endpoints";
import { qk, useConfig } from "../api/queries";
import type { MyProfile } from "../api/types";
import { useAuth } from "../auth/context";
import { PasswordRules } from "../components/PasswordRules";
import { RequireLogin } from "../components/RequireLogin";
import {
  ErrorBox,
  FieldError,
  FormMessage,
  Loading,
} from "../components/Status";
import { useToast } from "../components/toastContext";
import { formatDate, minutesUntil } from "../lib/format";
import { useUnsavedChangesPrompt } from "../lib/useUnsavedChangesPrompt";
import { isValidNickname, isValidPassword } from "../lib/validation";
import { ACCOUNT, AUTH, SOCIAL_LOGIN } from "../messages";

/**
 * 내 정보: 프로필 · 비밀번호 변경 · 회원 탈퇴, 위에 내 블로그 · 블로그 관리 바로가기 (CF-15, 데모 '내 정보').
 * 소셜로 가입해 비밀번호를 정한 적 없는 회원은 비밀번호 변경을 숨기고, 탈퇴는 확인 문구로 한다.
 */
export function MyPage() {
  return <RequireLogin>{() => <MyPageLoader />}</RequireLogin>;
}

function MyPageLoader() {
  const q = useQuery({ queryKey: qk.myProfile, queryFn: getMyProfile });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <MyPageForms key={`${q.data.nickname}|${q.data.bio}`} profile={q.data} />
  );
}

function lockedMessage(err: unknown): string {
  if (
    isApiError(err) &&
    err.code === "ACCOUNT_LOCKED" &&
    typeof err.details.unlockAt === "string"
  ) {
    return AUTH.accountLocked(minutesUntil(err.details.unlockAt, Date.now()));
  }
  return errorMessage(err);
}

function MyPageForms({ profile }: Readonly<{ profile: MyProfile }>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { doLogout } = useAuth();
  const { limits } = useConfig();
  const ids = {
    email: useId(),
    nickname: useId(),
    bio: useId(),
    cur: useId(),
    next: useId(),
    next2: useId(),
    wPw: useId(),
    wAck: useId(),
  };

  /* 내 정보 */
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [profileErrors, setProfileErrors] = useState<{
    nickname?: string;
    bio?: string;
  }>({});
  const [profileMsg, setProfileMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const profileBusy = useRef(false);

  /* 비밀번호 변경 */
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [pwErrors, setPwErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    newPasswordConfirm?: string;
  }>({});
  const [pwMsg, setPwMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const pwBusy = useRef(false);

  /* 탈퇴 */
  const [wPw, setWPw] = useState("");
  const [ack, setAck] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const wBusy = useRef(false);

  const { passwordSet } = profile;
  const connected = profile.socialAccounts
    .map((p) => SOCIAL_LOGIN.providerName[p] ?? p)
    .join(" · ");
  const signupProvider = profile.socialAccounts[0];
  const signupProviderName = signupProvider
    ? (SOCIAL_LOGIN.providerName[signupProvider] ?? signupProvider)
    : "";
  const withdrawReady = passwordSet ? wPw !== "" : true;

  const profileChanged =
    nickname.trim() !== profile.nickname || bio !== (profile.bio ?? "");
  const dirty = profileChanged || cur !== "" || next !== "" || next2 !== "";
  const allowNavigation = useUnsavedChangesPrompt(dirty);

  const onSaveProfile = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: typeof profileErrors = {};
    if (!isValidNickname(nickname, limits.nicknameMin, limits.nicknameMax))
      errs.nickname = AUTH.nicknameRule;
    if (bio.length > limits.bioMax)
      errs.bio = ACCOUNT.bioTooLong(limits.bioMax);
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0 || !profileChanged || profileBusy.current)
      return;
    profileBusy.current = true;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const body: { nickname?: string; bio?: string } = {};
      if (nickname.trim() !== profile.nickname) body.nickname = nickname.trim();
      if (bio !== (profile.bio ?? "")) body.bio = bio;
      await updateMyProfile(body);
      toast.show(ACCOUNT.saved);
      // 새 값으로 다시 그린다 (key 가 바뀌어 폼이 새 값으로 초기화된다)
      void queryClient.invalidateQueries({ queryKey: qk.myProfile });
      void queryClient.invalidateQueries({ queryKey: qk.me });
      void queryClient.invalidateQueries({ queryKey: ["blog"] });
    } catch (err) {
      if (isApiError(err) && err.code === "NICKNAME_TAKEN")
        setProfileErrors({ nickname: errorMessage(err) });
      else if (isApiError(err) && Object.keys(err.fields).length > 0)
        setProfileErrors({
          nickname: err.fields.nickname,
          bio: err.fields.bio,
        });
      else setProfileMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      profileBusy.current = false;
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: typeof pwErrors = {};
    if (!cur) errs.currentPassword = AUTH.required;
    if (!next) errs.newPassword = AUTH.required;
    else if (!isValidPassword(next, limits.passwordMin, limits.passwordMax))
      errs.newPassword = AUTH.passwordRule;
    else if (next === cur) errs.newPassword = ACCOUNT.sameAsCurrent;
    if (!next2) errs.newPasswordConfirm = AUTH.required;
    else if (next !== next2) errs.newPasswordConfirm = AUTH.passwordMismatch;
    setPwErrors(errs);
    if (Object.keys(errs).length > 0 || pwBusy.current) return;
    pwBusy.current = true;
    setSavingPw(true);
    setPwMsg(null);
    try {
      await changePassword({
        currentPassword: cur,
        newPassword: next,
        newPasswordConfirm: next2,
      });
      setCur("");
      setNext("");
      setNext2("");
      setPwMsg({ kind: "ok", text: ACCOUNT.passwordChanged });
    } catch (err) {
      setCur("");
      if (isApiError(err) && err.code === "CURRENT_PASSWORD_MISMATCH")
        setPwErrors({ currentPassword: errorMessage(err) });
      else if (isApiError(err) && err.code === "SAME_AS_CURRENT")
        setPwErrors({ newPassword: errorMessage(err) });
      else if (isApiError(err) && Object.keys(err.fields).length > 0)
        setPwErrors({
          currentPassword: err.fields.currentPassword,
          newPassword: err.fields.newPassword,
          newPasswordConfirm: err.fields.newPasswordConfirm,
        });
      else setPwMsg({ kind: "error", text: lockedMessage(err) });
    } finally {
      pwBusy.current = false;
      setSavingPw(false);
    }
  };

  const onWithdraw = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ack) return setWError(ACCOUNT.acknowledgeRequired);
    if (passwordSet && !wPw) return setWError(AUTH.required);
    if (wBusy.current) return;
    if (!window.confirm(ACCOUNT.withdrawConfirm(limits.withdrawKeepDays)))
      return;
    wBusy.current = true;
    setWithdrawing(true);
    setWError(null);
    try {
      if (!passwordSet) {
        // 가입한 소셜 계정으로 다시 로그인하러 간다. 돌아오면 서버가 탈퇴를 마치고 안내한다
        const { redirectUrl } = await withdrawBySocial();
        allowNavigation();
        window.location.assign(redirectUrl);
        return;
      }
      await withdraw({ password: wPw, acknowledged: true });
      allowNavigation();
      // 먼저 첫 화면으로 옮긴 뒤 로그아웃 상태로 바꾼다 (로그인 창이 뜨지 않게)
      void navigate("/", { replace: true });
      await doLogout();
      toast.show(ACCOUNT.withdrawn);
    } catch (err) {
      setWPw("");
      setWError(lockedMessage(err));
    } finally {
      wBusy.current = false;
      setWithdrawing(false);
    }
  };

  return (
    <div className="mypage">
      <div className="page-head-row">
        <h1 className="page-title">내 정보</h1>
        <div className="page-head-row__actions">
          <Link
            to={`/blogs/${profile.blogId}`}
            className="btn btn--sm btn--outline"
          >
            내 블로그
          </Link>
          <Link to="/manage" className="btn btn--sm btn--outline">
            블로그 관리
          </Link>
        </div>
      </div>

      <section className="card section-card">
        <h2 className="section-card__title">내 정보</h2>
        <form className="form" onSubmit={onSaveProfile} noValidate>
          <div className="field">
            <label htmlFor={ids.email} className="field__label">
              이메일
            </label>
            <input
              id={ids.email}
              className="input"
              value={profile.email}
              disabled
            />
            <p className="form__hint">로그인 아이디라 바꿀 수 없어요.</p>
          </div>
          {connected && (
            <div className="field">
              <span className="field__label">연결된 계정</span>
              <p className="form__hint">{SOCIAL_LOGIN.connected(connected)}</p>
            </div>
          )}
          <div className="field">
            <label htmlFor={ids.nickname} className="field__label">
              닉네임
            </label>
            <input
              id={ids.nickname}
              className="input"
              value={nickname}
              aria-invalid={!!profileErrors.nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setProfileErrors((p) => ({ ...p, nickname: undefined }));
              }}
            />
            <FieldError message={profileErrors.nickname} />
            <p className="form__hint">
              한글 · 영문 · 숫자 {limits.nicknameMin}~{limits.nicknameMax}자,
              다른 회원과 겹칠 수 없어요.
            </p>
          </div>
          <div className="field">
            <label htmlFor={ids.bio} className="field__label">
              소개
            </label>
            <textarea
              id={ids.bio}
              className="input textarea"
              rows={3}
              maxLength={limits.bioMax}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <div className="field__foot">
              <FieldError message={profileErrors.bio} />
              <span className="counter">
                {bio.length}/{limits.bioMax}
              </span>
            </div>
          </div>
          <p className="form__hint">가입일 {formatDate(profile.createdAt)}</p>
          <FormMessage
            kind={profileMsg?.kind ?? "info"}
            message={profileMsg?.text}
          />
          <div className="form__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!profileChanged || savingProfile}
            >
              저장
            </button>
          </div>
        </form>
      </section>

      {passwordSet && (
        <section className="card section-card">
          <h2 className="section-card__title">비밀번호 변경</h2>
          <form className="form" onSubmit={onChangePassword} noValidate>
            <div className="field">
              <label htmlFor={ids.cur} className="field__label">
                현재 비밀번호
              </label>
              <input
                id={ids.cur}
                className="input"
                type="password"
                autoComplete="current-password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
              />
              <FieldError message={pwErrors.currentPassword} />
            </div>
            <div className="field">
              <label htmlFor={ids.next} className="field__label">
                새 비밀번호
              </label>
              <input
                id={ids.next}
                className="input"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <PasswordRules
                value={next}
                min={limits.passwordMin}
                max={limits.passwordMax}
              />
              <FieldError message={pwErrors.newPassword} />
            </div>
            <div className="field">
              <label htmlFor={ids.next2} className="field__label">
                새 비밀번호 확인
              </label>
              <input
                id={ids.next2}
                className="input"
                type="password"
                autoComplete="new-password"
                value={next2}
                onChange={(e) => setNext2(e.target.value)}
              />
              <FieldError
                message={
                  pwErrors.newPasswordConfirm ??
                  (next2 && next !== next2 ? AUTH.passwordMismatch : null)
                }
              />
            </div>
            <FormMessage kind={pwMsg?.kind ?? "info"} message={pwMsg?.text} />
            <div className="form__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={savingPw}
              >
                비밀번호 변경
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card section-card section-card--danger">
        <h2 className="section-card__title">회원 탈퇴</h2>
        <div className="notice">
          <p>
            <strong>
              탈퇴하면 바로 로그아웃되고, 내 블로그와 글은 다른 사람에게 보이지
              않습니다. {limits.withdrawKeepDays}일 안에 다시 로그인하면 복구할
              수 있습니다.
            </strong>
          </p>
          <p>
            {limits.withdrawKeepDays}일이 지나면 삭제되는 것: 내 블로그, 글,
            다이어리, 내 블로그 글에 달린 댓글, 내가 누른 좋아요, 이메일·닉네임
            등 개인정보
          </p>
          <p>
            남는 것: 다른 사람 글에 단 댓글 (작성자는 “탈퇴한 사용자”로 표시)
          </p>
          <p>그동안에는 같은 이메일로 다시 가입할 수 없습니다.</p>
        </div>
        <form className="form" onSubmit={onWithdraw} noValidate>
          {passwordSet ? (
            <div className="field">
              <label htmlFor={ids.wPw} className="field__label">
                비밀번호 확인
              </label>
              <input
                id={ids.wPw}
                className="input"
                type="password"
                autoComplete="current-password"
                value={wPw}
                onChange={(e) => setWPw(e.target.value)}
              />
            </div>
          ) : (
            <p className="form__hint">
              {ACCOUNT.socialWithdrawHint(signupProviderName)}
            </p>
          )}
          <label className="checkbox" htmlFor={ids.wAck}>
            <input
              id={ids.wAck}
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            위 안내를 모두 확인했습니다
          </label>
          <FieldError message={wError} />
          <div className="form__actions">
            <button
              type="submit"
              className="btn btn--danger"
              disabled={!ack || !withdrawReady || withdrawing}
            >
              {passwordSet
                ? "탈퇴하기"
                : ACCOUNT.socialWithdrawButton(signupProviderName)}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
