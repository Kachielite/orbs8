/**
 * LangSmith Integration Guide for Orbs8 Project
 *
 * This guide explains how to integrate LangSmith tracing and monitoring
 * into your NestJS application for better observability of LLM operations.
 */

export const LANGSMITH_INTEGRATION_GUIDE = {
  setup: {
    title: 'Setup Instructions',
    steps: [
      '1. Install langsmith package: npm install langsmith',
      '2. Get API key from https://smith.langchain.com',
      '3. Add environment variables to your .env file',
      '4. Import LangSmithModule in your app.module.ts',
      '5. Use LangSmithService in your services for configuration',
    ],
  },

  environmentVariables: {
    title: 'Required Environment Variables',
    variables: {
      LANGSMITH_API_KEY: 'Your LangSmith API key from the dashboard',
      LANGSMITH_PROJECT: 'Project name for organizing traces (default: orbs8-project)',
      LANGSMITH_ENDPOINT: 'LangSmith API endpoint (default: https://api.smith.langchain.com)',
      LANGSMITH_TRACING: 'Enable/disable tracing (default: true)',
      LANGSMITH_WORKSPACE_ID: 'Optional workspace identifier',
    },
  },

  usage: {
    title: 'Usage Examples',
    examples: [
      'Automatic tracing is enabled for all LangChain operations',
      'Use LangSmithService.isLangSmithEnabled() to check if tracing is active',
      'Monitor traces in the LangSmith dashboard',
      'Set custom tags and metadata for better organization',
    ],
  },

  bestPractices: {
    title: 'Best Practices',
    tips: [
      'Use descriptive project names for better organization',
      'Set up different projects for dev/staging/prod environments',
      'Monitor token usage and costs through the dashboard',
      'Use tags to categorize different types of operations',
      'Regularly review traces for performance optimization',
    ],
  },
};

export default LANGSMITH_INTEGRATION_GUIDE;
