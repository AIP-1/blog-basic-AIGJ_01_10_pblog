import { useLocation } from 'react-router';
import { MarkdownView } from '../components/MarkdownView';
import { NotFound } from '../components/NotFound';
import { POLICIES, POLICY_UPDATED } from '../lib/policies';

/** 이용약관 · 개인정보처리방침 · 운영정책 */
export function PolicyPage() {
  const { pathname } = useLocation();
  const policy = POLICIES.find((p) => p.path === pathname);
  if (!policy) return <NotFound what="페이지" />;
  return (
    <div className="narrow">
      <header className="page-head">
        <h1 className="page-head__title">{policy.title}</h1>
        <p className="page-head__meta">시행일 {POLICY_UPDATED}</p>
      </header>
      <MarkdownView source={policy.body} className="policy" />
    </div>
  );
}
