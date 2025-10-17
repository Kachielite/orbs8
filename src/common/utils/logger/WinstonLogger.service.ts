import { LoggerService } from '@nestjs/common';
import logger from './logger';

export class WinstonLogger implements LoggerService {
  log(message: any, context?: string) {
    logger.info(this.formatMessage(message, context));
  }

  error(message: any, trace?: string, context?: string) {
    const msg = this.formatMessage(message, context);
    const traceStr = trace ? `\n${trace}` : '';
    logger.error(msg + traceStr);
  }

  warn(message: any, context?: string) {
    logger.warn(this.formatMessage(message, context));
  }

  debug?(message: any, context?: string) {
    logger.debug(this.formatMessage(message, context));
  }

  verbose?(message: any, context?: string) {
    logger.verbose(this.formatMessage(message, context));
  }

  private safeStringify(msg: any): string {
    if (msg === undefined) return '';
    if (msg === null) return 'null';
    if (typeof msg === 'string') return msg;
    if (msg instanceof Error) return msg.stack || msg.message || String(msg);
    try {
      if (typeof msg === 'object') return JSON.stringify(msg);
      return String(msg);
    } catch {
      return String(msg);
    }
  }

  private formatMessage(message: any, context?: string): string {
    const msgStr = this.safeStringify(message);
    return context ? `[${context}] ${msgStr}` : msgStr;
  }
}
