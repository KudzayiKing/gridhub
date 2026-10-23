import type { BaseRecord } from "../types";

export type DataMap = Record<string, BaseRecord[]>;

export function rows<T extends BaseRecord>(data: DataMap, collection: string): T[] {
  return (data[collection] ?? []) as unknown as T[];
}

export function options(list: { id: string; name?: string; label?: string }[]): { value: string; label: string }[] {
  return list.map((item) => ({ value: item.id, label: item.label ?? item.name ?? item.id }));
}

export function sumOf<T>(list: T[], pick: (row: T) => number): number {
  return list.reduce((acc, row) => acc + (Number.isFinite(pick(row)) ? pick(row) : 0), 0);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStart(): string {
  return `${today().slice(0, 7)}-01`;
}

export const TX_TYPES = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer (internal)" },
  { value: "savings", label: "Savings transfer" },
];

export const ACCOUNT_KINDS = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit card" },
  { value: "investment", label: "Investment" },
];
