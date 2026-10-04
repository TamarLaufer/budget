import { StyleSheet, Text, View } from "react-native";

import { formatAgorot } from "../budget/money";
import type { BudgetUsage } from "../budget/types";
import { colors, fontSize, radius, spacing } from "../theme";
import { ProgressBar } from "./ProgressBar";

interface BudgetSummaryProps {
  totals: BudgetUsage;
}

export function BudgetSummary({ totals }: BudgetSummaryProps) {
  const balanceLabel = totals.isOver ? "חריגה" : "יתרה";
  const balanceColor = totals.isOver ? colors.danger : colors.success;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SummaryItem label="תקציב כולל" value={formatAgorot(totals.budget)} />
        <SummaryItem label="הוצאות" value={formatAgorot(totals.spent)} />
        <SummaryItem
          label={balanceLabel}
          value={formatAgorot(Math.abs(totals.remaining))}
          color={balanceColor}
        />
      </View>
      <ProgressBar fill={totals.fill} percentUsed={totals.percentUsed} isOver={totals.isOver} />
      <Text style={styles.caption}>נוצלו {totals.percentUsed}% מהתקציב החודשי</Text>
    </View>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  color?: string;
}

function SummaryItem({ label, value, color = colors.text }: SummaryItemProps) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={[styles.itemValue, { color }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  itemLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  itemValue: {
    fontSize: fontSize.value,
    fontWeight: "700",
  },
  caption: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
});
