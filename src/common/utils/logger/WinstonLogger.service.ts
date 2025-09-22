import { LoggerService } from '@nestjs/common';
import logger from './logger';

export class WinstonLogger implements LoggerService {
  log(message: any, context?: string) {
    logger.info(this.formatMessage(message, context));
  }

  error(message: any, trace?: string, context?: string) {
    logger.error(this.formatMessage(message, context) + (trace ? `\n${trace}` : ''));
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

  private formatMessage(message: any, context?: string): string {
    return context ? `[${context}] ${message}` : message;
  }
}
