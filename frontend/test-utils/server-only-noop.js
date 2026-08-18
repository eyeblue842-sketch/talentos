// Vitest has no client/server bundle split, so the real `server-only`
// package (which unconditionally throws) would break every test that
// imports lib/auth.js or lib/api.js. Next.js's own webpack config aliases
// `server-only` to a no-op when building the server bundle - this mirrors
// that behavior for tests. See vitest.config.js.
export {};
