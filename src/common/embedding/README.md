# Embedding Configuration

This module provides a reusable embedding configuration using OpenAI embeddings with LangSmith tracing integration.

## Features

- **OpenAI Embeddings**: Uses `text-embedding-3-small` model for generating embeddings
- **LangSmith Tracing**: Automatic tracing and logging to LangSmith for monitoring and debugging
- **Singleton Pattern**: Pre-configured instance for easy use across modules
- **TypeScript Support**: Full type safety and IntelliSense support

## Setup

Ensure the following environment variables are set in your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# LangSmith Configuration
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=your_project_name
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_TRACING=true
```

## Usage

### Basic Usage (Recommended)

```typescript
import { embeddingConfig } from '../common/configurations/embedding.config';

// Generate embedding for a single text
const embedding = await embeddingConfig.embedText('Hello world');
console.log('Embedding dimensions:', embedding.length); // 1536

// Generate embeddings for multiple texts
const embeddings = await embeddingConfig.embedTexts([
  'First document',
  'Second document',
  'Third document'
]);
console.log('Number of embeddings:', embeddings.length); // 3
```

### Advanced Usage

```typescript
import { EmbeddingConfig } from '../common/configurations/embedding.config';

// Create a new instance (not recommended for most cases)
const customEmbedding = new EmbeddingConfig();

// Get the raw OpenAI embeddings instance
const rawEmbeddings = customEmbedding.getEmbeddings();
```

### Usage in NestJS Services

```typescript
import { Injectable } from '@nestjs/common';
import { embeddingConfig } from '../common/configurations/embedding.config';

@Injectable()
export class MyService {
  async processDocument(text: string) {
    const embedding = await embeddingConfig.embedText(text);
    
    // Use the embedding for similarity search, storage, etc.
    return embedding;
  }
}
```

## API Reference

### EmbeddingConfig Class

#### Methods

- `embedText(text: string): Promise<number[]>`
  - Generate embedding for a single text
  - Returns a 1536-dimensional vector

- `embedTexts(texts: string[]): Promise<number[][]>`
  - Generate embeddings for multiple texts
  - Returns an array of 1536-dimensional vectors

- `getEmbeddings(): OpenAIEmbeddings`
  - Get the underlying OpenAI embeddings instance
  - Useful for advanced configurations

### Singleton Instance

- `embeddingConfig`: Pre-configured singleton instance ready to use

## LangSmith Integration

All embedding operations are automatically traced to LangSmith when properly configured. You can monitor:

- API calls to OpenAI
- Response times
- Token usage
- Error rates

Visit your LangSmith dashboard to view traces and analytics.

## Error Handling

The configuration handles common errors gracefully:

- Missing API keys (will throw descriptive errors)
- Network failures (OpenAI client handles retries)
- Invalid input (validates text parameters)

## Example Output

```javascript
// Single text embedding
[
  0.014838580042123795,
  0.012378036975860596,
  0.017361892387270927,
  // ... 1533 more values
]

// Multiple texts embedding
[
  [0.014838580042123795, 0.012378036975860596, ...], // First text
  [0.018234567890123456, 0.023456789012345678, ...], // Second text
  [0.034567890123456789, 0.045678901234567890, ...], // Third text
]
```