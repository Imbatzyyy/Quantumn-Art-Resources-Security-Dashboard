// Change a version whenever its corresponding notice changes. The server imports
// these same identifiers and stores acceptance in protected Auth app_metadata.
export const TERMS_VERSION = '2026-09-30.1'
export const PRIVACY_VERSION = '2026-09-30.1'

export const accountPolicies = [
  {
    id: 'terms', title: 'Terms and Conditions', version: TERMS_VERSION,
    introduction: 'These terms cover your use of the Quantumn Art Resources employee portal. They do not replace your employment agreement or your organization’s HR policies.',
    sections: [
      ['Use your own account', 'Use the account issued to you for authorized work and HR tasks. Keep your password, email verification codes, authenticator codes, and recovery links private. Do not share access or attempt to view records outside your assigned permissions.'],
      ['Keep submissions accurate', 'Provide accurate information when submitting attendance corrections, leave requests, HR requests, and other records. Contact HR when an employment record needs correction. A submission is not an approval; follow the status and response shown in the portal.'],
      ['Handle information responsibly', 'Use employee records and downloaded documents only for their authorized purpose. Do not misuse, redistribute, or expose another person’s personal information. Report suspected unauthorized access to your organization’s HR team or System Administrator.'],
      ['Account access and support', 'Your organization manages your account, role, and employment records. Access may change when your role or employment status changes. If you cannot use the portal or disagree with these terms, sign out and contact HR to discuss an appropriate way to complete your HR tasks.'],
    ],
  },
  {
    id: 'privacy', title: 'Privacy Notice', version: PRIVACY_VERSION,
    introduction: 'This notice explains the information handled by this HRMS. Acknowledging it records that you have read it; it is not consent to unrelated uses of your information.',
    sections: [
      ['Information handled', 'Depending on the features your organization uses, the portal contains identity and contact information, employment details, attendance, leave, payroll and benefits, performance records, HR requests and documents, and your optional profile photo. It also records account activity, security alerts, sessions, and audit events.'],
      ['Why it is used', 'These records support employment administration, delivery of HR services, communication, access control, and investigation of account or system security issues. This notice does not authorize unrelated marketing or unrelated use of employee information.'],
      ['Access and service providers', 'Access is restricted by account and role. Authorized HR, payroll, security, and system administrators can access records needed for their assigned responsibilities. The application uses Supabase for authentication and data storage, Netlify for hosting and server operations, and Resend for application email delivery.'],
      ['Your choices and questions', 'You can review your available records and update the fields enabled in your profile. Contact your organization’s HR team for corrections, privacy questions, applicable retention periods, or requests about your personal information. Some records may need to be retained for employment or other applicable obligations; this portal does not promise immediate deletion of every record.'],
      ['Record of acknowledgment', 'When you finish account setup, the system records the versions of these terms and this notice, your agreement and acknowledgment, and the server time. Your password is not included in that acknowledgment record.'],
    ],
  },
]

export function validSetupAcknowledgment(value) {
  return value?.termsAccepted === true && value?.privacyAcknowledged === true
    && value.termsVersion === TERMS_VERSION && value.privacyVersion === PRIVACY_VERSION
}
