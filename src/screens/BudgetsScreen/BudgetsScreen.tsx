import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import type { CategoryDto, MonthlyBudgetDto } from "../../../shared/api";
import { errorMessage, messageFromUnknown } from "../../api/errorMessage";
import { formatMonthYear } from "../../budget/calculations";
import { agorotToInput, formatAgorot, parseShekelInput } from "../../budget/money";
import { periodToDate, type Period } from "../../budget/period";
import Header from "../../components/Header/Header";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorBanner, ErrorView, LoadingView } from "../../components/ui/Feedback";
import { BodyText, Card, MutedText, Row, ScrollScreen } from "../../components/ui/Layout";
import { TextField } from "../../components/ui/TextField";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectActiveCategories, selectBudgetsForPeriod, type Dataset } from "../../store/selectors";
import { deleteBudget, upsertBudget } from "../../store/slices/budgetsSlice";
import { periodShifted } from "../../store/slices/periodSlice";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";

/** What this screen shows; loaded when missing, stale or past the freshness limit. */
const DATASETS: readonly Dataset[] = ["budgets", "categories"];

/** Per-category budgets for the selected month. Saving one month never changes another. */
export default function BudgetsScreen() {
  const dispatch = useAppDispatch();
  const { period, load, refresh, refreshing } = useScreenData(DATASETS);
  const categories = useAppSelector(selectActiveCategories);
  const budgets = useAppSelector(selectBudgetsForPeriod);

  if (!load.loaded && load.status === "failed") return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  if (!load.loaded) return <LoadingView />;

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: strings.BUDGETS_TITLE }} />
      <Header
        title={strings.BUDGETS_TITLE}
        month={periodToDate(period)}
        onPrevious={() => dispatch(periodShifted(-1))}
        onNext={() => dispatch(periodShifted(1))}
      />
      {categories.length === 0 ? <EmptyState title={strings.NO_CATEGORIES} hint={strings.NO_CATEGORIES_HINT} /> : null}
      {categories.map((category) => (
        // Keyed by month too, so the inputs reset when switching months.
        <BudgetRow
          key={`${category.id}:${period.year}-${period.month}`}
          category={category}
          period={period}
          budget={budgetByCategory.get(category.id)}
        />
      ))}
    </ScrollScreen>
  );
}

function BudgetRow({ category, period, budget }: { category: CategoryDto; period: Period; budget?: MonthlyBudgetDto }) {
  const dispatch = useAppDispatch();
  const [text, setText] = useState(budget ? agorotToInput(budget.amountAgorot) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = text.trim() === "" ? null : parseShekelInput(text);
  const invalid = text.trim() !== "" && parsed === null;
  const unchanged = budget ? parsed === budget.amountAgorot : text.trim() === "";

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (parsed === null && budget) {
        await dispatch(deleteBudget(budget.id)).unwrap();
      } else if (parsed !== null) {
        await dispatch(upsertBudget({ categoryId: category.id, year: period.year, month: period.month, amountAgorot: parsed })).unwrap();
      }
      setSaved(true);
    } catch (e) {
      setError(messageFromUnknown(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <BodyText>{category.name}</BodyText>
      <MutedText>
        {budget ? formatAgorot(budget.amountAgorot) : strings.NO_BUDGET_SET} ·{" "}
        {format(strings.BUDGET_FOR_MONTH, { month: formatMonthYear(periodToDate(period)) })}
      </MutedText>
      <Row>
        <View style={{ flex: 1 }}>
          <TextField
          value={text}
          onChangeText={(value) => {
            setText(value);
            setSaved(false);
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          accessibilityLabel={`${strings.BUDGET} ${category.name}`}
          error={invalid ? strings.FORM_ERRORS.AMOUNT_INVALID : null}
          />
        </View>
        <Button label={saved ? strings.BUDGET_SAVED : strings.SAVE} compact loading={busy} disabled={invalid || unchanged} onPress={save} />
      </Row>
      <ErrorBanner message={error} />
    </Card>
  );
}
