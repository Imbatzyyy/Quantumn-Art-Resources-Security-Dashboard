import { supabaseProvider } from './supabaseProvider.js'
import type { HrmsDataProvider } from '../types/hrms.js'

// Supabase is the sole runtime system of record. The legacy provider remains
// JavaScript for now, but every consumer crosses this narrow typed boundary.
// HR data is never read from or written to browser storage or a bundled demo.
export const providerName = 'supabase' as const
export const dataProvider: HrmsDataProvider = supabaseProvider
