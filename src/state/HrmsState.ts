import { createContext } from 'react'
import type { HrmsContextValue } from '../types/hrms.js'

export const HrmsState = createContext<HrmsContextValue | null>(null)
