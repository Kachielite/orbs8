// LangSmith Environment Variables Configuration
// Add these to your environment variables (.env file or deployment config)

import { envConstants } from '../common/constants/env.secrets';

export const langSmithEnvConfig = {
  // Required for LangSmith tracking
  LANGSMITH_API_KEY: envConstants.LANGSMITH_API_KEY, // Get from https://smith.langchain.com
  LANGSMITH_PROJECT: envConstants.LANGSMITH_PROJECT,
  // Optional LangSmith settings
  LANGSMITH_ENDPOINT: envConstants.LANGSMITH_ENDPOINT,
  LANGSMITH_TRACING: envConstants.LANGSMITH_TRACING,
};
