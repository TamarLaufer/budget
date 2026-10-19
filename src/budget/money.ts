import { MAX_AMOUNT_AGOROT } from "../../shared/limits";
import { format } from "../strings/format";
import { strings } from "../strings/he";

/** Integer amount in agorot (1 ₪ = 100 agorot). */
export type Agorot = number;

const AGOROT_PER_SHEKEL = 100;

export function shekelsToAgorot(shekels: number): Agorot {
  return Math.round(shekels * AGOROT_PER_SHEKEL);
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Formats an amount as shekels, e.g. 240000 → "2,400 ₪". Agorot are shown only when present. */
export function formatAgorot(amount: Agorot): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const shekels = Math.floor(absolute / AGOROT_PER_SHEKEL);
  const agorot = absolute % AGOROT_PER_SHEKEL;
  const fraction = agorot === 0 ? "" : `.${String(agorot).padStart(2, "0")}`;
  return format(strings.SHEKEL_AMOUNT, { amount: `${sign}${groupThousands(shekels)}${fraction}` });
}

// Whole shekels (thousands separators allowed), optionally followed by up to two agorot digits.
const SHEKEL_INPUT = /^(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses what a user typed in a shekel field ("87.9", "87,90", "1,250", "₪ 40") into agorot.
 * Works on the digits as text, never through floating-point arithmetic, so "0.29" is exactly 29.
 * Returns null for anything that is not a valid non-negative amount within the allowed range.
 */
export function parseShekelInput(input: string): Agorot | null {
  const cleaned = input.replace(/[\s₪]/g, "");
  const match = SHEKEL_INPUT.exec(cleaned);
  if (!match) return null;
  const whole = Number((match[1] ?? "").replace(/,/g, ""));
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const agorot = whole * AGOROT_PER_SHEKEL + fraction;
  return Number.isSafeInteger(agorot) && agorot <= MAX_AMOUNT_AGOROT ? agorot : null;
}

/** Inverse of parseShekelInput for pre-filling edit forms: 8790 → "87.90", 5000 → "50". */
export function agorotToInput(amount: Agorot): string {
  const shekels = Math.floor(amount / AGOROT_PER_SHEKEL);
  const agorot = amount % AGOROT_PER_SHEKEL;
  return agorot === 0 ? String(shekels) : `${shekels}.${String(agorot).padStart(2, "0")}`;
}
