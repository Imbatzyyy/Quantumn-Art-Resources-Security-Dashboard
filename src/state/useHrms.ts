import { useContext } from 'react'
import { HrmsState } from './HrmsState.js'
import type { HrmsContextValue } from '../types/hrms.js'

export function useHrms(): HrmsContextValue {
  const context = useContext(HrmsState)
  if (!context) throw new Error('useHrms must be used inside HrmsProvider')
  return context
}
