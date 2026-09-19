// e2e/global-setup.ts
//
// Starts an in-memory MongoDB (mongodb-memory-server — no real network,
// no Docker, no external service needed) BEFORE Playwright's webServer
// boots `next dev`, and writes the resulting connection string to
// `.env.development.local` so Next.js picks it up via its normal env-file
// loading.
//
// Deliberately `next dev`, not a production build: `next dev` always
// forces `process.env.NODE_ENV` to 'development' regardless of what's
// passed in, which is exactly what's needed here — customerAuth.ts's
// dev-mode convenience (handing the one-time sign-in code back in the API
// response, gated on `NODE_ENV !== 'production'`) is what lets the
// customer-sign-in E2E spec read the code straight from the page instead
// of needing a real email provider. Since Next resolves env files by the
// ACTUAL NODE_ENV it ends up running under, the file has to be named
// `.env.development.local` — `.env.test.local` would silently never load
// under `next dev`.
//
// Playwright runs a `globalSetup` file to completion before starting the
// configured webServer, so the env file is guaranteed to exist by the
// time `next dev` reads it.
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import { seed } from '../scripts/seed-e2e';

const ENV_FILE = path.resolve(__dirname, '../.env.development.local');
const STATE_FILE = path.resolve(__dirname, '.mongo-memory-server-uri');

export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'chair-app' } });
  const uri = mongod.getUri('chair-app');

  fs.writeFileSync(STATE_FILE, uri, 'utf-8');
  fs.writeFileSync(ENV_FILE, `MONGODB_URI=${uri}\n`, 'utf-8');

  process.env.MONGODB_URI = uri;
  await seed();

  // Returning a teardown function is Playwright's preferred pattern over a
  // separate globalTeardown file when the two need to share state (like
  // the `mongod` handle) — avoids re-deriving it from disk.
  return async () => {
    await mongod.stop();
    if (fs.existsSync(ENV_FILE)) fs.unlinkSync(ENV_FILE);
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  };
}
