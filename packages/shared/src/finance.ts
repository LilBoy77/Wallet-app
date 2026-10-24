import { z } from 'zod';

/**
 * Validates a financial amount in integer minor units (IDR Rupiah).
 * Disallows float, decimals, NaN, Infinity, -0, scientific notation representation anomalies,
 * and numbers beyond the safe integer boundary.
 */
export const moneyAmountSchema = z
  .number({ invalid_type_error: 'Nominal harus berupa angka numerik' })
  .int('Nominal harus berupa bilangan bulat tanpa desimal')
  .positive('Nominal harus lebih besar dari 0')
  .max(1_000_000_000_000, 'Nominal melebihi batas maksimal sistem (1 Triliun IDR)')
  .refine((val) => !Object.is(val, -0), 'Nominal tidak boleh -0')
  .refine((val) => Number.isSafeInteger(val), 'Nominal berada di luar batas integer aman');

/**
 * Pure Domain Arithmetic: BigInt-based addition preventing precision loss.
 */
export function safeAddMoney(a: bigint | number | string, b: bigint | number | string): bigint {
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  const sum = bigA + bigB;
  if (sum < 0n) {
    throw new Error('Hasil penjumlahan saldo menghasilkan nilai negatif');
  }
  return sum;
}

/**
 * Pure Domain Arithmetic: BigInt-based subtraction preventing negative balances.
 */
export function safeSubtractMoney(
  balance: bigint | number | string,
  deduction: bigint | number | string
): bigint {
  const bigBalance = BigInt(balance);
  const bigDeduction = BigInt(deduction);
  if (bigDeduction < 0n) {
    throw new Error('Nilai pengurangan tidak boleh negatif');
  }
  if (bigBalance < bigDeduction) {
    throw new Error('Saldo tidak mencukupi untuk pengurangan ini');
  }
  return bigBalance - bigDeduction;
}

/**
 * Formats integer minor units into standard Indonesian Rupiah display format.
 */
export function formatIdr(amount: bigint | number | string): string {
  const num = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Deterministically sorts keys of an object to produce a canonical JSON representation.
 */
export function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify((obj as Record<string, unknown>)[key])}`
  );
  return `{${entries.join(',')}}`;
}

/**
 * Pure Domain State Machine: Validates transaction status transitions.
 */
export type TransactionStatus = 'COMPLETED' | 'VOIDED';

export const VALID_TRANSACTION_TRANSITIONS: Record<
  TransactionStatus,
  readonly TransactionStatus[]
> = {
  COMPLETED: ['VOIDED'],
  VOIDED: [], // Terminal state, immutable
};

export function canTransitionTransaction(from: TransactionStatus, to: TransactionStatus): boolean {
  if (from === to) return false;
  const allowed = VALID_TRANSACTION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Pure Domain State Machine: Validates transfer status transitions.
 */
export type TransferStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export const VALID_TRANSFER_TRANSITIONS: Record<TransferStatus, readonly TransferStatus[]> = {
  pending: ['completed', 'failed'],
  completed: ['reversed'],
  failed: [], // Terminal state
  reversed: [], // Terminal state
};

export function canTransitionTransfer(from: TransferStatus, to: TransferStatus): boolean {
  if (from === to) return false;
  const allowed = VALID_TRANSFER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// -------------------------------------------------------------
// DTOs & Validation Schemas for Wallets, Transactions, Transfers
// -------------------------------------------------------------

// 1. Wallets
export interface WalletResponse {
  id: string;
  user_id: string;
  wallet_number: string;
  currency: 'IDR';
  balance: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const updateWalletInputSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama dompet minimal 1 karakter')
    .max(100, 'Nama dompet maksimal 100 karakter')
    .optional(),
  is_active: z.boolean().optional(),
});

export type UpdateWalletInput = z.infer<typeof updateWalletInputSchema>;

export const topupSimulationInputSchema = z.object({
  amount: moneyAmountSchema,
});

export type TopupSimulationInput = z.infer<typeof topupSimulationInputSchema>;

export interface WalletEntryResponse {
  id: string;
  wallet_id: string;
  reference_id: string | null;
  reference_type: string;
  entry_type: 'debit' | 'credit';
  amount: number;
  balance_after: number;
  created_at: string;
}

// 2. Transactions
export const createTransactionInputSchema = z.object({
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: "Tipe transaksi harus 'income' atau 'expense'" }),
  }),
  category_id: z.string().uuid('ID kategori harus berformat UUID yang valid'),
  amount: moneyAmountSchema,
  transaction_date: z
    .string()
    .datetime({ message: 'Tanggal transaksi harus berformat ISO 8601' })
    .optional(),
  description: z.string().max(1000, 'Deskripsi maksimal 1000 karakter').default(''),
  tag_ids: z.array(z.string().uuid('Tag ID harus berupa UUID')).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const updateTransactionMetadataInputSchema = z.object({
  category_id: z.string().uuid('ID kategori harus berformat UUID yang valid').optional(),
  description: z.string().max(1000, 'Deskripsi maksimal 1000 karakter').optional(),
  tag_ids: z.array(z.string().uuid('Tag ID harus berupa UUID')).optional(),
});

export type UpdateTransactionMetadataInput = z.infer<typeof updateTransactionMetadataInputSchema>;

export interface TransactionResponse {
  id: string;
  wallet_id: string;
  category_id: string;
  type: 'income' | 'expense';
  amount: number;
  status: TransactionStatus;
  transaction_date: string;
  description: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: {
    id: string;
    name: string;
    type: string;
    color?: string;
    icon?: string;
  };
  tags?: Array<{
    id: string;
    name: string;
  }>;
}

// 3. Transfers
export const createTransferInputSchema = z.object({
  target_wallet_number: z
    .string()
    .trim()
    .min(3, 'Nomor wallet tujuan tidak valid')
    .max(32, 'Nomor wallet tujuan maksimal 32 karakter'),
  amount: moneyAmountSchema,
  note: z.string().max(500, 'Catatan transfer maksimal 500 karakter').optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferInputSchema>;

export interface TransferResponse {
  id: string;
  source_wallet_id: string;
  target_wallet_id: string;
  source_wallet_number: string;
  target_wallet_number: string;
  amount: number;
  status: TransferStatus;
  note: string | null;
  idempotency_key: string;
  created_at: string;
}
