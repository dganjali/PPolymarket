/**
 * Lets plain `node` run the app's TypeScript modules directly.
 *
 * Usage: node --import ./scripts/ts-resolve.mjs scripts/seed.ts
 */
import { register } from 'node:module';

// `registerHooks` is only available in newer Node 22 releases. The asynchronous
// loader registration API works across every Node version supported by Next 15.
register('./ts-hooks.mjs', import.meta.url);
