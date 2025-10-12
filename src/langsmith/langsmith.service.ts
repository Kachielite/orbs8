import { Injectable } from '@nestjs/common';
import { envConstants } from '../common/constants/env.secrets';

@Injectable()
export class LangSmithService {
  constructor() {
    this.initializeLangSmith();
  }

  public isLangSmithEnabled(): boolean {
    return !!envConstants.LANGSMITH_API_KEY && envConstants.LANGSMITH_TRACING === 'true';
  }

  public getLangSmithConfig() {
    return {
      apiKey: envConstants.LANGSMITH_API_KEY,
      project: envConstants.LANGSMITH_PROJECT,
      endpoint: envConstants.LANGSMITH_ENDPOINT,
      tracing: envConstants.LANGSMITH_TRACING,
    };
  }

  private initializeLangSmith() {
    // Set LangSmith environment variables if available
    if (envConstants.LANGSMITH_API_KEY) {
      process.env.LANGSMITH_API_KEY = envConstants.LANGSMITH_API_KEY;
    }

    if (envConstants.LANGSMITH_PROJECT) {
      process.env.LANGSMITH_PROJECT = envConstants.LANGSMITH_PROJECT;
    }

    if (envConstants.LANGSMITH_ENDPOINT) {
      process.env.LANGSMITH_ENDPOINT = envConstants.LANGSMITH_ENDPOINT;
    }

    if (envConstants.LANGSMITH_TRACING) {
      process.env.LANGSMITH_TRACING = envConstants.LANGSMITH_TRACING;
    }
  }
}
