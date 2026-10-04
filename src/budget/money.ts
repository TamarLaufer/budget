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
  return `${sign}${groupThousands(shekels)}${fraction} ₪`;
}
