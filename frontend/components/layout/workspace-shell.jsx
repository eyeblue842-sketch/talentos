// Backward-compatible alias: every existing authenticated page imports
// WorkspaceShell by this name. CareerizAppShell is the actual, more capable
// implementation (right-context slot, page-header slots, token-driven rail
// widths) - kept as a separate, more descriptively named module so new
// pages can adopt the name directly, without a mass rename of ~50 existing
// call sites that already work correctly against this export.
export { CareerizAppShell as WorkspaceShell } from '@/components/layout/careeriz-app-shell';
