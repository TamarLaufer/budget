import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildMonthlySnapshot, formatMonthYear } from "../budget/calculations";
import type { BudgetCategory } from "../budget/types";
import { BudgetSummary } from "../components/BudgetSummary";
import { CategoryCard } from "../components/CategoryCard";
import { strings } from "../strings/he";
import { colors, fontSize, spacing } from "../theme";

interface MonthlySnapshotScreenProps {
  categories: BudgetCategory[];
  month: Date;
}

export function MonthlySnapshotScreen({
  categories,
  month,
}: MonthlySnapshotScreenProps) {
  const insets = useSafeAreaInsets();
  const snapshot = useMemo(
    () => buildMonthlySnapshot(categories),
    [categories],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {strings.MY_BUDGET}
        </Text>
        <Text style={styles.month}>{formatMonthYear(month)}</Text>
      </View>

      <BudgetSummary totals={snapshot.totals} />

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {strings.CATEGORIES}
      </Text>
      {snapshot.categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  month: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  sectionTitle: {
    fontSize: fontSize.heading,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
});
