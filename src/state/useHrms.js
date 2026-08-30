import { useContext } from 'react'
import { HrmsState } from './HrmsState.js'

export function useHrms() {
  const context = useContext(HrmsState)
  if (!context) throw new Error('useHrms must be used inside HrmsProvider')
  return context
}
