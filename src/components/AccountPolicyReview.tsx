import { BookOpen, ShieldCheck } from 'lucide-react'
import { accountPolicies } from '../utils/accountPolicies.js'
import { Banner, FormFooter } from './readable.js'

interface Props {
  termsAccepted: boolean
  privacyAcknowledged: boolean
  onTermsChange: (checked: boolean) => void
  onPrivacyChange: (checked: boolean) => void
  onContinue: () => void
  onSignOut: () => void
}

export default function AccountPolicyReview(props: Props) {
  return <div className="rf-form rf-form--md account-policy-review">
    <div className="rf-first-login-notice">
      <Banner icon={BookOpen} label="Account setup · Step 1 of 2" title="Before you set your password">
        Take a moment to review how to use your workspace and how your information is handled.
      </Banner>
    </div>
    <div className="account-policy-content">
      {accountPolicies.map((policy) => <section className="account-policy-document" key={policy.id} aria-labelledby={`policy-${policy.id}`}>
        <header><h3 id={`policy-${policy.id}`}>{policy.title}</h3><span>Version {policy.version}</span></header>
        <p>{policy.introduction}</p>
        <div className="account-policy-sections">{policy.sections.map(([title, body]) => <section key={title}><h4>{title}</h4><p>{body}</p></section>)}</div>
      </section>)}
      <div className="account-policy-checks">
        <p><a href="/terms" target="_blank" rel="noreferrer">Open Terms in a new tab</a> · <a href="/privacy" target="_blank" rel="noreferrer">Open Privacy Notice in a new tab</a></p>
        <label><input type="checkbox" checked={props.termsAccepted} onChange={event => props.onTermsChange(event.target.checked)} /><span>I have read and agree to the Terms and Conditions.</span></label>
        <label><input type="checkbox" checked={props.privacyAcknowledged} onChange={event => props.onPrivacyChange(event.target.checked)} /><span>I have read and acknowledge the Privacy Notice.</span></label>
        <p>These selections are recorded when you finish password setup. If you have questions, sign out and contact your HR team before continuing.</p>
      </div>
    </div>
    <FormFooter icon={ShieldCheck} note="Next: create your private password.">
      <button className="button button-secondary" type="button" onClick={props.onSignOut}>Sign out instead</button>
      <button className="button button-primary" type="button" disabled={!props.termsAccepted || !props.privacyAcknowledged} onClick={props.onContinue}>Continue to password</button>
    </FormFooter>
  </div>
}
