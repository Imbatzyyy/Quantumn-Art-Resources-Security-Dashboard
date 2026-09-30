import { useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { accountPolicies, policyContact, policyReferences } from '../utils/accountPolicies.js'
import { readThemePreference } from '../utils/theme.js'

export default function AccountPolicyPage({ kind }: { kind: 'terms' | 'privacy' }) {
  useLayoutEffect(() => { document.documentElement.dataset.theme = readThemePreference() }, [])
  const policy = accountPolicies.find(item => item.id === kind)!
  return <main className="account-policy-page">
    <div className="account-policy-shell">
      <header className="account-policy-page-header">
        <img src={logoBlue} alt="Quantumn Art Resources" />
        <nav aria-label="Policy navigation"><Link to="/terms" aria-current={kind === 'terms' ? 'page' : undefined}>Terms</Link><Link to="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined}>Privacy</Link></nav>
      </header>
      <article className="account-policy-document">
        <header><h1>{policy.title}</h1><span>Version {policy.version}</span></header>
        <p>{policy.introduction}</p>
        <aside className="account-policy-contact" aria-label="Academic project contact"><strong>{policyContact.organization}</strong><p>{policyContact.role}</p><p><a href={`mailto:${policyContact.email}`}>{policyContact.email}</a></p><p>{policyContact.location}. Mailbox ownership and monitoring are unverified; do not email sensitive records without confirming the recipient.</p></aside>
        <nav className="account-policy-index" aria-label="On this page">{policy.sections.map(([title], index) => <a key={title} href={`#section-${index}`}>{title}</a>)}</nav>
        <div className="account-policy-sections">{policy.sections.map(([title, body], index) => <section id={`section-${index}`} key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>
        <aside className="account-policy-sources" aria-label="Official Philippine privacy references"><h2>Official Philippine privacy references</h2><p>Read the law, your rights, and the Commission’s current guidance directly.</p><ul>{policyReferences.map(reference => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a></li>)}</ul></aside>
      </article>
      <footer><p><ShieldCheck size={18} aria-hidden="true" />Privacy acknowledgment is not blanket consent or a waiver of rights.</p><div><Link to="/employee/login"><ArrowLeft size={16} aria-hidden="true" />Employee sign in</Link><Link to="/admin/login">Administrator sign in</Link></div></footer>
    </div>
  </main>
}
