import pino from 'pino';

/**
 * JSON logger with redaction.
 *
 * Worker phone numbers, message bodies and audio paths are personal data, and
 * the SMS pipeline handles all three. Redaction is configured by key name so a
 * new field named `phone_e164` or `transcript` is covered by the first entry
 * that matches, including nested request/response payloads.
 */
const redact: { paths: string[]; censor: string } = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'password',
    '*.password',
    'phone',
    '*.phone',
    'phone_e164',
    '*.phone_e164',
    'from_phone',
    '*.from_phone',
    'to_phone',
    '*.to_phone',
    'body',
    '*.body',
    'text',
    '*.text',
    'transcript',
    '*.transcript',
    'audio',
    '*.audio',
    'audio_path',
    '*.audio_path',
    'reason_audio_path',
    '*.reason_audio_path',
    'narrative',
    '*.narrative',
  ],
  censor: '[redacted]',
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function newRequestId(): string {
  return crypto.randomUUID();
}
