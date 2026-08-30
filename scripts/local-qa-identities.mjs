import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const localQaAccounts = [
  {
    email: 'admin@quantum.test',
    metadata: { first_name: 'Prince', last_name: 'Balane' },
    appMetadata: { role: 'admin', must_set_password: false },
  },
  {
    email: 'employee@quantum.test',
    metadata: { first_name: 'David', last_name: 'Santos' },
    appMetadata: { role: 'employee', must_set_password: false },
  },
]

export const generateQaPassword = () => `Qa!7${randomBytes(18).toString('base64url')}`

export const seedLocalQaIdentities = async ({ apiUrl, serviceRoleKey }) => {
  const adminClient = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userPage, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError

  const passwords = new Map()
  for (const account of localQaAccounts) {
    const password = generateQaPassword()
    passwords.set(account.email, password)
    const existing = userPage.users.find((user) => user.email?.toLowerCase() === account.email)
    const attributes = {
      password,
      email_confirm: true,
      user_metadata: account.metadata,
      app_metadata: account.appMetadata,
    }
    const result = existing
      ? await adminClient.auth.admin.updateUserById(existing.id, attributes)
      : await adminClient.auth.admin.createUser({ email: account.email, ...attributes })
    if (result.error) throw result.error
  }

  const { data: linkedProfiles, error: profileError } = await adminClient
    .from('profiles')
    .select('email, auth_user_id, role, status')
    .in('email', localQaAccounts.map(({ email }) => email))
  if (profileError) throw profileError
  if (linkedProfiles.length !== localQaAccounts.length || linkedProfiles.some((profile) => !profile.auth_user_id)) {
    throw new Error('Local QA Auth users were not linked to both fictional HRMS profiles.')
  }

  return { adminClient, passwords }
}
