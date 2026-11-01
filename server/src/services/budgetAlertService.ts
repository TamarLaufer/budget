import type { BudgetAlertPushData, TransactionDto } from "../../../shared/api.js";
import type { Logger } from "../config/logger.js";
import * as budgetAlertsRepository from "../repositories/budgetAlertsRepository.js";
import * as budgetsRepository from "../repositories/budgetsRepository.js";
import * as categoriesRepository from "../repositories/categoriesRepository.js";
import * as pushDevicesRepository from "../repositories/pushDevicesRepository.js";
import * as transactionsRepository from "../repositories/transactionsRepository.js";
import { currentPeriod, monthRange } from "../utils/dates.js";
import type { PushMessage, PushSender } from "./push/pushSender.js";

/*
 * Budget threshold alerts (80% / 100% of a category's monthly budget).
 *
 * Rules:
 * - Usage follows the app's budget rules: the sum of EXPENSE transactions of the category in the
 *   calendar month, against that month's MonthlyBudget. Income never counts. Money is integer agorot.
 * - Only expenses dated in the household's current month are evaluated. Missing or zero budgets
 *   never alert. Budget edits do not trigger alerts.
 * - Each threshold is sent at most once per household, category and month. A BudgetAlert row is
 *   the claim; its unique key makes this safe under concurrent requests.
 * - Re-arming policy: none within a month. If an edit or delete drops usage back below a threshold,
 *   that threshold does not fire again that month. A new month has its own rows, so it starts fresh.
 * - A jump from below 80% straight to 100%+ records both thresholds but sends only the 100% alert.
 *
 * Failure isolation: `afterExpenseSaved` runs after the transaction is committed, never throws,
 * and waits at most `deadlineMs`; slower work finishes in the background and only logs.
 */

export const THRESHOLDS = [80, 100] as const;
export type Threshold = (typeof THRESHOLDS)[number];

/** Highest threshold reached, using integer math only. null when below 80% or the budget is not positive. */
export function thresholdReached(budgetAgorot: number, spentAgorot: number): Threshold | null {
  if (!Number.isSafeInteger(budgetAgorot) || budgetAgorot <= 0) return null;
  let reached: Threshold | null = null;
  for (const threshold of THRESHOLDS) {
    if (spentAgorot * 100 >= budgetAgorot * threshold) reached = threshold;
  }
  return reached;
}

const MESSAGES: Record<Threshold, { title: string; body: (category: string) => string }> = {
  80: { title: "מתקרבים לתקציב", body: (category) => `ניצלתם 80% מתקציב "${category}" החודשי.` },
  100: { title: "התקציב נוצל", body: (category) => `ניצלתם את מלוא תקציב "${category}" החודשי.` },
};

export interface BudgetAlertsOptions {
  pushSender: PushSender;
  logger: Logger;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** Upper bound on the extra time a save request waits for alert processing. */
  deadlineMs?: number;
}

export interface BudgetAlerts {
  /** Call after a transaction was created or updated. Never throws. */
  afterExpenseSaved(householdId: string, transaction: TransactionDto): Promise<void>;
}

export const DEFAULT_ALERT_DEADLINE_MS = 3_000;

export function createBudgetAlerts({
  pushSender,
  logger,
  now = () => new Date(),
  deadlineMs = DEFAULT_ALERT_DEADLINE_MS,
}: BudgetAlertsOptions): BudgetAlerts {
  async function send(householdId: string, categoryId: string, year: number, month: number, threshold: Threshold) {
    const recipients = await pushDevicesRepository.listBudgetAlertRecipients(householdId);
    if (recipients.length === 0) return;
    const category = await categoriesRepository.findInHousehold(householdId, categoryId);
    if (!category) return;

    const data: BudgetAlertPushData = { type: "budget-alert", year, month, categoryId };
    const messages: PushMessage[] = recipients.map((r) => ({
      to: r.expoPushToken,
      title: MESSAGES[threshold].title,
      body: MESSAGES[threshold].body(category.name),
      data: { ...data },
    }));

    const results = await pushSender.send(messages);
    const unregistered = messages
      .filter((_, i) => {
        const result = results[i];
        return result && !result.ok && result.deviceNotRegistered;
      })
      .map((m) => m.to);
    if (unregistered.length > 0) await pushDevicesRepository.removeTokens(unregistered);

    const failed = results.filter((r) => !r.ok).length;
    logger.info({ householdId, threshold, sent: messages.length, failed, removed: unregistered.length }, "budget alert");
  }

  async function evaluate(householdId: string, transaction: TransactionDto): Promise<void> {
    const { type, categoryId, transactionDate } = transaction;
    if (type !== "EXPENSE" || !categoryId) return;

    const year = Number(transactionDate.slice(0, 4));
    const month = Number(transactionDate.slice(5, 7));
    const current = currentPeriod(now());
    if (year !== current.year || month !== current.month) return;

    const budget = await budgetsRepository.findForCategoryMonth(householdId, categoryId, year, month);
    if (!budget) return;
    const spent = await transactionsRepository.sumExpenses(householdId, categoryId, monthRange(year, month));
    const reached = thresholdReached(budget.amountAgorot, spent);
    if (!reached) return;

    const key = { householdId, categoryId, year, month };
    // Lower thresholds are recorded silently so they never fire after a higher one.
    for (const lower of THRESHOLDS.filter((t) => t < reached)) {
      await budgetAlertsRepository.claim(key, lower);
    }
    if (!(await budgetAlertsRepository.claim(key, reached))) return;

    await send(householdId, categoryId, year, month, reached);
  }

  return {
    async afterExpenseSaved(householdId, transaction) {
      const work = evaluate(householdId, transaction).catch((error: unknown) => {
        logger.error({ err: error, householdId }, "budget alert failed");
      });
      let timer: NodeJS.Timeout | undefined;
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          logger.warn({ householdId, deadlineMs }, "budget alert still running; continuing in background");
          resolve();
        }, deadlineMs);
      });
      await Promise.race([work, deadline]);
      clearTimeout(timer);
    },
  };
}
