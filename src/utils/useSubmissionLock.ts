import { useRef, useState } from 'react'

export function useSubmissionLock() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  return {
    busy,
    begin() {
      if (lock.current) return false
      lock.current = true
      setBusy(true)
      return true
    },
    finish() { lock.current = false; setBusy(false) },
  }
}
