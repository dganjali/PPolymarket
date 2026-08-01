import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

/** First of `base`, `base.ts`, `base.tsx`, `base/index.ts(x)` that exists. */
function firstExisting(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => existsSync(candidate) && !candidate.endsWith('/'));
}

export async function resolve(specifier, context, nextResolve) {
  // "@/lib/db" -> "<root>/src/lib/db"
  if (specifier.startsWith('@/')) {
    const hit = firstExisting(resolvePath(root, 'src', specifier.slice(2)));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  // "./db" -> "./db.ts", relative to the importing file
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const from = context.parentURL?.startsWith('file:')
      ? dirname(fileURLToPath(context.parentURL))
      : root;
    const hit = firstExisting(resolvePath(from, specifier));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
