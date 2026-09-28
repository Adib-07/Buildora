import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess | undefined;

async function waitForServer(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Any HTTP answer means the listener is up; the route itself is asserted
      // in the test file, not here.
      await fetch(`${BASE}/api/v1/me`, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`dev server did not become ready on ${BASE}`);
}

export async function setup() {
  // Piped rather than ignored so a failing integration test can be diagnosed
  // from the test output; vitest surfaces this as the server log.
  const log = openSync('/tmp/saakshi-test-server.log', 'a');
  server = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', log, log],
    detached: false,
    env: { ...process.env, ...loadLocalEnv() },
  });
  await waitForServer();
}

/**
 * The dev server is spawned from the vitest main process, which does not run
 * setupFiles, so .env.local is loaded here as well.
 */
function loadLocalEnv(): Record<string, string> {
  const file = resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export async function teardown() {
  server?.kill('SIGTERM');
  server = undefined;
}

export const API_BASE = BASE;
