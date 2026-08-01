/**
 * Lets plain `node` run the app's modules directly.
 *
 * `src/` uses bundler-style imports — no file extensions, and `@/…` for the
 * project root — which Next resolves but Node's ESM loader does not. This hook
 * fills both gaps so scripts (seed, tests) can import the real engine instead
 * of a copy of it.
 *
 * Usage: node --import ./scripts/ts-resolve.mjs scripts/seed.ts
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

/** First of `base`, `base.ts`, `base.tsx`, `base/index.ts(x)` that exists. */
function firstExisting(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => existsSync(c) && !c.endsWith('/'));
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // "@/lib/db" → "<root>/src/lib/db"
    if (specifier.startsWith('@/')) {
      const hit = firstExisting(resolvePath(root, 'src', specifier.slice(2)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }

    // "./db" → "./db.ts", relative to the importing file
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const from = context.parentURL?.startsWith('file:')
        ? dirname(fileURLToPath(context.parentURL))
        : root;
      const hit = firstExisting(resolvePath(from, specifier));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
