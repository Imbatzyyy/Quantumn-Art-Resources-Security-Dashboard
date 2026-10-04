import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Clock3, FileText, LifeBuoy, ReceiptText, ShieldCheck, UserRoundPen } from 'lucide-react'
import { SectionHeading } from '../../components/ui.js'
import type { NavigateProps } from './shared.js'

const topics = [
  { icon: Clock3, title: 'Fix my attendance', text: 'A missing or wrong clock-in or clock-out.', target: 'requests?new=Attendance%20Correction' },
  { icon: CalendarDays, title: 'Take time off', text: 'Request leave and check your balance.', target: 'leave' },
  { icon: ReceiptText, title: 'Question about my pay', text: 'An amount on a payslip looks wrong.', target: 'requests?new=Payroll%20Concern' },
  { icon: FileText, title: 'Request a document', text: 'Certificate of employment, memos, and more.', target: 'requests?new=Document%20Request' },
  { icon: UserRoundPen, title: 'Update my details', text: 'Your name, job details, or emergency contact.', target: 'requests?new=Profile%20Correction' },
  { icon: ShieldCheck, title: 'Sign-in and security', text: 'Change your password or set up two-step sign-in.', target: 'account-security' },
]

const faqs = [
  ['How do I correct a wrong clock-in or clock-out?', 'Open Time & Schedule and choose Request a correction. Include the date and the correct time. HR reviews the request and updates the official record; you can follow the decision in the Request Center.'],
  ['How long does leave approval take?', 'Your request goes to HR as soon as you submit it. You get a notification when it is approved or rejected, and the decision appears in your leave history.'],
  ['How is my leave balance calculated?', 'Your balance starts from the annual allowance and goes down when HR approves leave. Pending requests are shown separately so you can see what your balance will be once they are approved.'],
  ['When can I see my payslip?', 'Payslips appear in Pay & Benefits after payroll releases the pay period. Draft calculations are never shown. You can print a payslip or save it as a PDF.'],
  ['Who can see my HR requests?', 'Only you and authorized HR staff. Messages between you and HR stay in the request, together with the final decision.'],
  ['Why must I acknowledge some documents?', 'Some policies require confirmation that you have read them. Open the document, read it, and tick the confirmation. The date of your acknowledgement is recorded.'],
  ['How do I set up two-step sign-in?', 'Go to Account Security and choose Set up two-step sign-in. You will scan a code with an authenticator app, such as Google Authenticator or Microsoft Authenticator.'],
  ['I forgot my password. What do I do?', 'On the sign-in page, choose Forgot password? and follow the email link. If you no longer have access to your work email, contact HR.'],
]

export function HelpCenter({ onNavigate }: NavigateProps) {
  return <div className="page-stack">
    <SectionHeading
      title="HR Help Center"
      description="Find answers quickly, or send HR a request you can track."
      actions={<button className="button button-primary" onClick={() => onNavigate('requests?new=General%20HR')}><LifeBuoy aria-hidden="true" />Ask HR</button>}
    />
    <section className="panel">
      <div className="panel-header"><div><h2>What do you need help with?</h2><p>Each option opens the right form or page.</p></div></div>
      <div className="help-topics">{topics.map(({ icon: Icon, title, text, target }) => <button type="button" key={title} onClick={() => onNavigate(target)}>
        <span className="help-topic-icon" aria-hidden="true"><Icon /></span>
        <span><strong>{title}</strong><small>{text}</small></span>
        <ChevronRight aria-hidden="true" />
      </button>)}</div>
    </section>
    <section className="panel">
      <div className="panel-header"><div><h2>Frequently asked questions</h2></div></div>
      <div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>
    <section className="panel account-policy-help">
      <div className="panel-header"><div><h2>Terms and privacy</h2><p>How the portal works, how your information is handled, and how to exercise your privacy rights.</p></div></div>
      <div className="account-policy-help-links"><Link className="button button-secondary" to="/terms">Terms and Conditions</Link><Link className="button button-secondary" to="/privacy">Privacy Notice</Link></div>
    </section>
  </div>
}
