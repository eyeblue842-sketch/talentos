import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

// Guards against a real regression this repo hit: client billing
// components importing lib/api.js / lib/auth.js directly, which pulls
// next/headers into the client bundle and breaks the production build
// (and, transitively, exposes the shape of server-only request plumbing to
// browser JS). This statically walks each client component's own local
// import graph and fails if it ever again resolves to a server-only file.

const FRONTEND_ROOT = path.resolve(__dirname, '../../..');
const FORBIDDEN_SPECIFIERS = ['server-only', 'next/headers'];
const FORBIDDEN_FILES = [
  path.resolve(FRONTEND_ROOT, 'lib/auth.js'),
  path.resolve(FRONTEND_ROOT, 'lib/api.js'),
];

const CLIENT_ENTRY_POINTS = [
  'components/billing/billing-profile-form.jsx',
  'components/billing/razorpay-checkout-button.jsx',
  'components/billing/cancel-subscription-button.jsx',
];

function resolveImportPath(specifier, fromFile) {
  let resolved;
  if (specifier.startsWith('@/')) {
    resolved = path.resolve(FRONTEND_ROOT, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    resolved = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // node_modules package - not part of the local source graph.
  }

  const candidates = [resolved, `${resolved}.js`, `${resolved}.jsx`, `${resolved}.ts`, `${resolved}.tsx`];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const importRe = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match = importRe.exec(source);
  while (match) {
    specifiers.push(match[1]);
    match = importRe.exec(source);
  }
  return specifiers;
}

function walkImportGraph(entryFile) {
  const visited = new Set();
  const violations = [];

  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);

    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of extractImportSpecifiers(source)) {
      if (FORBIDDEN_SPECIFIERS.includes(specifier)) {
        violations.push(`${file} imports forbidden specifier "${specifier}"`);
        continue;
      }

      const resolved = resolveImportPath(specifier, file);
      if (!resolved) continue;

      if (FORBIDDEN_FILES.includes(resolved)) {
        violations.push(`${file} transitively imports server-only module ${path.relative(FRONTEND_ROOT, resolved)} (via "${specifier}")`);
        continue;
      }

      visit(resolved);
    }
  }

  visit(entryFile);
  return violations;
}

describe('billing client components never transitively import server-only code', () => {
  test.each(CLIENT_ENTRY_POINTS)('%s has no server-only dependency in its local import graph', (relativePath) => {
    const entryFile = path.resolve(FRONTEND_ROOT, relativePath);
    const source = fs.readFileSync(entryFile, 'utf8');
    expect(source.split('\n')[0]).toMatch(/use client/);

    const violations = walkImportGraph(entryFile);
    expect(violations).toEqual([]);
  });
});
