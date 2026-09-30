import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import AdminPasswordResetPage from './AdminPasswordResetPage.js'
import { requireSupabase } from '../services/supabaseClient.js'

vi.mock('../services/supabaseClient.js', () => ({ requireSupabase: vi.fn() }))
afterEach(() => { sessionStorage.clear(); vi.mocked(requireSupabase).mockReset() })

it.each([
  { requestId: 'not-a-request', expiresAt: '2099-01-01T00:00:00Z' },
  { requestId: '30000000-0000-4000-8000-000000000001', expiresAt: 'not-a-date' },
  { requestId: '30000000-0000-4000-8000-000000000001' },
  { requestId: '30000000-0000-4000-8000-000000000001', expiresAt: '2000-01-01T00:00:00Z' },
])('handles invalid or expired saved reset state without a page crash: %j', async saved => {
  sessionStorage.setItem('quantum-admin-password-reset', JSON.stringify(saved))
  render(<MemoryRouter><AdminPasswordResetPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid, expired, or already used.')
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  expect(requireSupabase).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('quantum-admin-password-reset')).toBeNull()
})
