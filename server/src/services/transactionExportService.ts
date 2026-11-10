import { Buffer } from "node:buffer";
import ExcelJS from "exceljs";

import { getPrisma } from "../db/prisma.js";
import {
  listExportBatch,
  TRANSACTION_EXPORT_BATCH_SIZE,
} from "../repositories/transactionsRepository.js";
import type { HouseholdContext } from "../types/auth.js";

type ExportTransaction =
  Awaited<ReturnType<typeof listExportBatch>>[number];

function createSheet(workbook: ExcelJS.Workbook, name: string) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1, rightToLeft: true }],
  });

  sheet.columns = [
    { header: "תאריך", key: "date", width: 15 },
    { header: "סוג תנועה", key: "type", width: 15 },
    { header: "קטגוריה", key: "category", width: 22 },
    { header: "תת־קטגוריה", key: "subCategory", width: 22 },
    { header: "תיאור", key: "description", width: 40 },
    { header: "סכום בשקלים", key: "amount", width: 18 },
    { header: "אמצעי תשלום", key: "paymentMethod", width: 22 },
    { header: "מקור הכנסה", key: "incomeSource", width: 24 },
    { header: "הוזן על ידי", key: "createdBy", width: 30 },
  ];

  sheet.getColumn("date").numFmt = "dd/mm/yyyy";
  sheet.getColumn("amount").numFmt = '#,##0.00 "₪"';

  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF087F6B" },
    };
    cell.alignment = {
      horizontal: "right",
      vertical: "middle",
    };
  });

  return sheet;
}

/** Reads a consistent snapshot, including transactions beyond the first batch. */
async function readTransactions(householdId: string) {
  return getPrisma().$transaction(
    async (db) => {
      const transactions: ExportTransaction[] = [];
      let afterId: string | undefined;

      while (true) {
        const batch = await listExportBatch(householdId, afterId, db);
        transactions.push(...batch);

        const last = batch.at(-1);
        if (!last || batch.length < TRANSACTION_EXPORT_BATCH_SIZE) break;

        afterId = last.id;
      }

      return transactions;
    },
    { isolationLevel: "RepeatableRead", timeout: 30_000 },
  );
}

export async function exportTransactionsToExcel(
  ctx: HouseholdContext,
): Promise<Buffer> {
  const transactions = await readTransactions(ctx.householdId);

  transactions.sort(
    (a, b) =>
      a.transactionDate.getTime() - b.transactionDate.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Spendo";
  workbook.created = new Date();

  for (const transaction of transactions) {
    // PostgreSQL DATE values are represented as UTC dates.
    const month = transaction.transactionDate.toISOString().slice(0, 7);
    const sheet =
      workbook.getWorksheet(month) ?? createSheet(workbook, month);

    sheet.addRow({
      date: transaction.transactionDate,
      type: transaction.type === "EXPENSE" ? "הוצאה" : "הכנסה",
      category: transaction.category?.name ?? "",
      subCategory: transaction.subCategory?.name ?? "",
      description: transaction.description ?? "",
      amount: transaction.amountAgorot / 100,
      paymentMethod: transaction.paymentMethod?.name ?? "",
      incomeSource: transaction.incomeSource ?? "",
      createdBy:
        transaction.createdBy.displayName?.trim() ||
        transaction.createdBy.email,
    });
  }

  if (transactions.length === 0) {
    const sheet = createSheet(workbook, "תנועות");
    sheet.mergeCells("A2:I2");
    sheet.getCell("A2").value = "אין תנועות לייצוא";
  }

  workbook.eachSheet((sheet) => {
    sheet.autoFilter = `A1:I${sheet.rowCount}`;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}