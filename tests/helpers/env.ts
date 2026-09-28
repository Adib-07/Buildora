// Loads .env.local into process.env for tests. Uses Node's built-in loader so
// no extra dotenv dependency is needed. Missing file is not an error: CI sets
// real variables directly.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54421';
export const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const SEED_PASSWORD = 'buildora-dev-password';

export const IDS = {
  siteA: '11111111-1111-4111-8111-111111111111',
  siteB: '22222222-2222-4222-8222-222222222222',
  staffASupervisor: 'a1111111-1111-4111-8111-111111111111',
  staffAEngineer: 'a2222222-2222-4222-8222-222222222222',
  staffBSupervisor: 'b1111111-1111-4111-8111-111111111111',
  workerA1: '0c000001-0000-4000-8000-000000000001',
  workerB1: '0d000001-0000-4000-8000-000000000001',
  hazardA1: '5a000001-0000-4000-8000-000000000001',
} as const;
