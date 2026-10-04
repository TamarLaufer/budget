import { StyleSheet, Text, View } from "react-native";

import { formatAgorot } from "../budget/money";
import type { CategorySummary } from "../budget/types";
import { colors, fontSize, radius, spacing } from "../theme";
import { ProgressBar } from "./ProgressBar";

interface CategoryCardProps {
  category: CategorySummary;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const { name, budget, spent, remaining, percentUsed, fill, isOver } = category;

  return (
    <View style={[styles.card, isOver && styles.cardOver]}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{name}</Text>
        {isOver ? (
          <View style={styles.overBadge}>
            <Text style={styles.overBadgeText}>חריגה מהתקציב</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>תקציב</Text>
        <Text style={styles.detailValue}>{formatAgorot(budget)}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>הוצאות</Text>
        <Text style={styles.detailValue}>{formatAgorot(spent)}</Text>
      </View>

      <ProgressBar fill={fill} percentUsed={percentUsed} isOver={isOver} />

      <View style={styles.detailRow}>
        <Text style={[styles.status, { color: isOver ? colors.danger : colors.success }]}>
          {isOver
            ? `חריגה של ${formatAgorot(-remaining)}`
            : `נותרו ${formatAgorot(remaining)}`}
        </Text>
        <Text style={[styles.percent, isOver && { color: colors.danger }]}>{percentUsed}%</Text>
      </View>
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
    gap: spacing.sm,
  },
  cardOver: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    flexShrink: 1,
    fontSize: fontSize.heading,
    fontWeight: "700",
    color: colors.text,
  },
  overBadge: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  overBadgeText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.danger,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  detailLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  status: {
    flexShrink: 1,
    fontSize: fontSize.body,
    fontWeight: "700",
  },
  percent: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
});
