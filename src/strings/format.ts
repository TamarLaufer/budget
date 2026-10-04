/**
 * Fills `{name}` placeholders in a translated template, so each language controls its own word order.
 * e.g. format("נותרו {amount}", { amount: "50 ₪" }) → "נותרו 50 ₪". Unknown placeholders are left as-is.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
