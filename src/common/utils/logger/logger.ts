import winston, { format } from 'winston';

const { combine, timestamp, label, printf, colorize } = format;

type LogInfo = {
  level: string;
  message: string;
  label?: string;
  timestamp?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: string;
} & Record<string, unknown>;

const myFormat = printf((raw: unknown) => {
  const info = raw as LogInfo;
  const { level, message } = info;
  const lbl = (info.label as string) ?? '';
  const ts = (info.timestamp as string) ?? '';

  let line = `${ts} [${lbl}] ${level}:: ${message}`;

  const parts: string[] = [];
  if (info.method) parts.push(`${info.method}`);
  if (info.url) parts.push(`${info.url}`);
  if (typeof info.statusCode !== 'undefined') parts.push(`status=${info.statusCode}`);
  if (info.responseTime) parts.push(`duration=${info.responseTime}`);

  if (parts.length) {
    line += ` | ${parts.join(' ')}`;
  }

  // Include any additional metadata fields as JSON (exclude known keys and splat)
  const known = new Set([
    'level',
    'message',
    'label',
    'timestamp',
    'method',
    'url',
    'statusCode',
    'responseTime',
    'splat',
  ]);
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(info as Record<string, unknown>)) {
    if (!known.has(k)) meta[k] = v;
  }
  if (Object.keys(meta).length) {
    line += ` | meta=${JSON.stringify(meta)}`;
  }

  return line;
});

const logger = winston.createLogger({
  format: combine(colorize(), label({ label: 'ORBS8 🛰️' }), timestamp(), myFormat),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: './logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: './logs/combined.log',
    }),
  ],
});

export default logger;
