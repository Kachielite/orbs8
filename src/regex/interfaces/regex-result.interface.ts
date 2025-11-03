export interface RegexExtractionResult {
  success: boolean;
  data?: {
    type?: string;
    amount?: number;
    currency?: string;
    date?: string;
    description?: string;
    currentBalance?: number;
    transactionId?: string;
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
  };
  error?: string;
  regexId?: number;
}

export interface RegexAuditResult {
  isValid: boolean;
  confidenceScore: number;
  notes: string;
  testResults?: Array<{
    field: string;
    passed: boolean;
    reason?: string;
  }>;
}
