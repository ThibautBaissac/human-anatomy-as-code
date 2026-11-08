// Keyboard model of the ARIA APG Tabs pattern (automatic activation). Pure.
export function tabsKeyReducer(tabs: string[], current: string, key: string): string {
  const i = tabs.indexOf(current);
  switch (key) {
    case 'ArrowRight': return tabs[(i + 1) % tabs.length];
    case 'ArrowLeft': return tabs[(i - 1 + tabs.length) % tabs.length];
    case 'Home': return tabs[0];
    case 'End': return tabs[tabs.length - 1];
    default: return current;
  }
}
