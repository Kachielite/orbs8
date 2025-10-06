export interface TransactionDetails {
  type: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  currentBalance: number;
  transactionId: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
}
