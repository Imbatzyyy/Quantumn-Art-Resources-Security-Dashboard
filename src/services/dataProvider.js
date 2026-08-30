import { supabaseProvider } from './supabaseProvider.js'

// Supabase is the sole runtime system of record. HR data is never read from or
// written to browser storage or a bundled demonstration snapshot.
export const providerName = 'supabase'
export const dataProvider = supabaseProvider
