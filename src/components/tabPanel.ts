/** Props for the panel controlled by a <Tabs> group with the same id prefix. */
export function tabPanelProps(prefix: string, active: string) {
  return { id: `${prefix}-panel`, role: 'tabpanel' as const, 'aria-labelledby': `${prefix}-tab-${active}`, tabIndex: 0 }
}
