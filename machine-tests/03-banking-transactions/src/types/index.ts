export interface Account {
  id: number;
  account_number: string;
  holder_name: string;
  balance: number;
  status: 'active' | 'frozen' | 'closed';
  pin: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  from_account: number | null;
  to_account: number | null;
  type: TransactionType;
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  created_at: string;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer';

export interface TransferRequest {
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  pin: string;
  description?: string;
}

export interface DepositRequest {
  accountId: number;
  amount: number;
}

export interface WithdrawalRequest {
  accountId: number;
  amount: number;
  pin: string;
}
