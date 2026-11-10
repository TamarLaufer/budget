import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { apiDownload } from "../api/client";
import { strings } from "../strings/he";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function shareTransactionsExcel(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(strings.EXPORT_SHARING_UNAVAILABLE);
  }

  const bytes = await apiDownload("/transactions/export");

  // XLSX files are ZIP containers, beginning with the PK signature.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error(strings.EXPORT_INVALID_FILE);
  }

  const file = new File(
    Paths.cache,
    `spendo-transactions-${Date.now()}.xlsx`,
  );

  file.create();
  await Promise.resolve(file.write(bytes));

  await Sharing.shareAsync(file.uri, {
    mimeType: EXCEL_MIME,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
    dialogTitle: strings.EXPORT_EXCEL,
  });
}