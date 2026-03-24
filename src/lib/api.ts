// Typed wrapper around window.api (set by preload)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api = (window as any).api as import('../../electron/preload').API
