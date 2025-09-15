import winston, { format } from 'winston';

const { combine, timestamp, label, printf, colorize } = format;

const myFormat = printf(
  ({
    level,
    message,
    label,
    timestamp,
  }: {
    level: string;
    message: string;
    label: string;
    timestamp: string;
  }) => {
    return `${timestamp} [${label}] ${level}:: ${message}`;
  },
);

const logger = winston.createLogger({
  format: combine(
    colorize(),
    label({ label: 'ORBS8 🛰️' }),
    timestamp(),
    myFormat,
  ),
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
