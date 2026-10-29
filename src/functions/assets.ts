import { type Agorot } from "../budget/money";
import { formatAgorot } from "../budget/money";

const LTR_ISOLATE = "\u2066";
const POP_DIRECTIONAL_ISOLATE = "\u2069";

export function formatCurrency(amount: Agorot): string {
  const formatted = formatAgorot(amount);

  // Extract the currency symbol and preserve the existing numeric formatting.
  const number = formatted.replace("₪", "").trim();

  return `${LTR_ISOLATE}₪ ${number}${POP_DIRECTIONAL_ISOLATE}`;
}