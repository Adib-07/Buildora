import { describe, expect, it } from 'vitest';

import {
  DateOnlySchema,
  ErrorCodeSchema,
  HoursSchema,
  PhoneSchema,
  TimestampSchema,
  errorStatus,
  endpoints,
  maskedPhone,
} from '@/contracts';

const HTTP_STATUSES = new Set(
  Array.from({ length: 600 }, (_, i) => i + 100),
);

describe('errorStatus', () => {
  it('covers every ErrorCode with a defined status', () => {
    for (const code of ErrorCodeSchema.options) {
      expect(errorStatus[code], `no status for ${code}`).toBeTypeOf('number');
    }
  });

  it('has no entries outside the ErrorCode enum', () => {
    for (const code of Object.keys(errorStatus)) {
      expect(ErrorCodeSchema.options, `unknown code ${code}`).toContain(code);
    }
  });

  it('maps every code to a real HTTP status', () => {
    for (const [code, status] of Object.entries(errorStatus)) {
      expect(HTTP_STATUSES.has(status), `${code} -> ${status}`).toBe(true);
    }
  });
});

describe('endpoint registry', () => {
  const entries = Object.entries(endpoints);

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('declares only real error codes on every endpoint', () => {
    for (const [name, endpoint] of entries) {
      for (const code of endpoint.errors) {
        expect(ErrorCodeSchema.options, `${name} declares ${code}`).toContain(code);
      }
    }
  });

  it('only uses paths under /api/', () => {
    for (const [name, endpoint] of entries) {
      expect(endpoint.path, name).toMatch(/^\/api\//);
    }
  });

  it('keeps the registry key in sync with method and full path', () => {
    for (const [key, endpoint] of entries) {
      const [method, keyPath] = key.split(' ');
      expect(endpoint.method, key).toBe(method);
      // Keys are the endpoint suffix; `path` is the full route, whose prefix is
      // /api/v1 for the staff API and /api/demo for the simulator.
      expect(keyPath, key).toMatch(/^\//);
      expect(endpoint.path.endsWith(keyPath), `${key} vs ${endpoint.path}`).toBe(true);
    }
  });
});

describe('maskedPhone', () => {
  it('masks the middle digits and keeps the last four', () => {
    expect(maskedPhone('+919876543210')).toBe('+91XXXXXX3210');
  });

  it('leaves a non-matching value untouched', () => {
    expect(maskedPhone('not-a-phone')).toBe('not-a-phone');
  });
});

describe('shared field schemas', () => {
  it('accepts hours in 0.5 steps and rejects finer ones', () => {
    expect(HoursSchema.safeParse(0).success).toBe(true);
    expect(HoursSchema.safeParse(7.5).success).toBe(true);
    expect(HoursSchema.safeParse(16).success).toBe(true);
    expect(HoursSchema.safeParse(7.3).success).toBe(false);
  });

  it('bounds hours to 0..16', () => {
    expect(HoursSchema.safeParse(-0.5).success).toBe(false);
    expect(HoursSchema.safeParse(16.5).success).toBe(false);
  });

  it('requires YYYY-MM-DD', () => {
    expect(DateOnlySchema.safeParse('2026-09-28').success).toBe(true);
    expect(DateOnlySchema.safeParse('28-09-2026').success).toBe(false);
  });

  it('requires E.164 Indian numbers', () => {
    expect(PhoneSchema.safeParse('+919876543210').success).toBe(true);
    expect(PhoneSchema.safeParse('9876543210').success).toBe(false);
  });

  it('requires ISO-8601 datetimes', () => {
    expect(TimestampSchema.safeParse('2026-09-28T09:30:00Z').success).toBe(true);
    expect(TimestampSchema.safeParse('2026-09-28 09:30').success).toBe(false);
  });
});
