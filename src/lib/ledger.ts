import { dec, round2, sum, type DecimalValue } from "./money";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type AccountTotals = { id: string; code: string; nameAr: string; nameEn: string; type: AccountType; debit: DecimalValue; credit: DecimalValue };

/** Assets and expenses carry debit balances; liabilities, equity and revenue carry credit balances. */
export const isDebitNature = (type: AccountType) => type === "ASSET" || type === "EXPENSE";

/** Balance in the account's natural direction (positive = normal). */
export const naturalBalance = (a: { type: AccountType; debit: DecimalValue; credit: DecimalValue }) =>
  round2(isDebitNature(a.type) ? dec(a.debit).minus(dec(a.credit)) : dec(a.credit).minus(dec(a.debit)));

/** Trial balance: each account's net shown on its debit or credit side; totals must agree. */
export function trialBalance(accounts: AccountTotals[]) {
  const rows = accounts
    .map((a) => {
      const net = round2(dec(a.debit).minus(dec(a.credit)));
      return { ...a, debit: net.greaterThan(0) ? net : dec(0), credit: net.lessThan(0) ? net.negated() : dec(0) };
    })
    .filter((r) => !r.debit.isZero() || !r.credit.isZero())
    .sort((x, y) => x.code.localeCompare(y.code));
  const debit = sum(rows.map((r) => r.debit));
  const credit = sum(rows.map((r) => r.credit));
  return { rows, debit, credit, balanced: debit.equals(credit) };
}

/** Profit and loss for a period from revenue and expense account movements. */
export function profitAndLoss(accounts: AccountTotals[]) {
  const pick = (type: AccountType) =>
    accounts
      .filter((a) => a.type === type)
      .map((a) => ({ ...a, amount: naturalBalance(a) }))
      .filter((a) => !a.amount.isZero())
      .sort((x, y) => x.code.localeCompare(y.code));
  const revenue = pick("REVENUE");
  const expenses = pick("EXPENSE");
  const totalRevenue = sum(revenue.map((r) => r.amount));
  const totalExpenses = sum(expenses.map((e) => e.amount));
  return { revenue, expenses, totalRevenue, totalExpenses, net: totalRevenue.minus(totalExpenses) };
}

/**
 * Balance sheet as of a date from cumulative movements. Revenue and expense accounts are not closed,
 * so their net is shown as current earnings inside equity; assets then equal liabilities plus equity.
 */
export function balanceSheet(accounts: AccountTotals[]) {
  const section = (type: AccountType) =>
    accounts
      .filter((a) => a.type === type)
      .map((a) => ({ ...a, amount: naturalBalance(a) }))
      .filter((a) => !a.amount.isZero())
      .sort((x, y) => x.code.localeCompare(y.code));
  const assets = section("ASSET");
  const liabilities = section("LIABILITY");
  const equity = section("EQUITY");
  const earnings = profitAndLoss(accounts).net;
  const totalAssets = sum(assets.map((a) => a.amount));
  const totalLiabilities = sum(liabilities.map((a) => a.amount));
  const totalEquity = sum(equity.map((a) => a.amount)).plus(earnings);
  return { assets, liabilities, equity, earnings, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets.equals(totalLiabilities.plus(totalEquity)) };
}

/** VAT return figures for a period: output VAT charged, input VAT recoverable and the net payable (negative = refundable). */
export function vatReturn(input: { outputVat: { debit: DecimalValue; credit: DecimalValue }; inputVat: { debit: DecimalValue; credit: DecimalValue }; standardRatedSales: DecimalValue; expenses: DecimalValue }) {
  const output = round2(dec(input.outputVat.credit).minus(dec(input.outputVat.debit)));
  const inputVat = round2(dec(input.inputVat.debit).minus(dec(input.inputVat.credit)));
  return { standardRatedSales: round2(input.standardRatedSales), outputVat: output, expenses: round2(input.expenses), inputVat, netPayable: output.minus(inputVat) };
}

/** Running balance for an account statement, in the account's natural direction. */
export function runningBalance<T extends { debit: DecimalValue; credit: DecimalValue }>(type: AccountType, opening: DecimalValue, lines: T[]) {
  let balance = dec(opening);
  return lines.map((l) => {
    balance = balance.plus(isDebitNature(type) ? dec(l.debit).minus(dec(l.credit)) : dec(l.credit).minus(dec(l.debit)));
    return { ...l, balance: round2(balance) };
  });
}
