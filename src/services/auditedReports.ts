import { requireSupabase } from './supabaseClient.js'
export async function prepareReport(reportId: string, searchText = ''): Promise<object[]> {
  const { data, error } = await requireSupabase().rpc('prepare_hr_report', { report_id: reportId, search_text: searchText })
  if (error) throw error
  if (!data || Array.isArray(data) || typeof data !== 'object' || !Array.isArray(data.rows)
    || !data.rows.every(row => row !== null && typeof row === 'object' && !Array.isArray(row))
    || typeof data.auditId !== 'number') throw new Error('An audited report could not be prepared.')
  return data.rows as object[]
}
