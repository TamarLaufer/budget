import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import type { CategoryDto, MonthlyBudgetDto } from "../../../shared/api";
import { messageFromUnknown } from "../../api/errorMessage";
import { formatMonthYear } from "../../budget/calculations";
import {
  agorotToInput,
  formatAgorot,
  parseShekelInput,
} from "../../budget/money";
import { periodToDate, type Period } from "../../budget/period";
import { useAppDispatch } from "../../store";
import { deleteBudget, upsertBudget } from "../../store/slices/budgetsSlice";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import { Button } from "../ui/Button";
import { ErrorBanner } from "../ui/Feedback";
import { BodyText, Card, MutedText, Row } from "../ui/Layout";
import { TextField } from "../ui/TextField";

interface BudgetRowProps {
  category: CategoryDto;
  period: Period;
  budget?: MonthlyBudgetDto;
  canManage: boolean;
}

export function BudgetRow({
  category,
  period,
  budget,
  canManage,
}: BudgetRowProps) {
  const dispatch = useAppDispatch();
  const budgetText = budget ? agorotToInput(budget.amountAgorot) : "";
  const [text, setText] = useState(budgetText);
  const previousBudgetText = useRef(budgetText);

  useEffect(() => {
    const previous = previousBudgetText.current;
    previousBudgetText.current = budgetText;

    setText((current) =>
      current === previous ? budgetText : current,
    );
  }, [budgetText]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const empty = text.trim() === "";
  const parsed = empty ? null : parseShekelInput(text);
  const invalid = !empty && parsed === null;
  const unchanged = budget ? parsed === budget.amountAgorot : empty;

  const save = async () => {
    if (!canManage || busy || invalid || unchanged) return;

    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      if (empty && budget) {
        await dispatch(deleteBudget(budget.id)).unwrap();
      } else if (parsed !== null) {
        await dispatch(
          upsertBudget({
            categoryId: category.id,
            year: period.year,
            month: period.month,
            amountAgorot: parsed,
          }),
        ).unwrap();
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
        {budget ? formatAgorot(budget.amountAgorot) : strings.NO_BUDGET_SET}
        {" · "}
        {format(strings.BUDGET_FOR_MONTH, {
          month: formatMonthYear(periodToDate(period)),
        })}
      </MutedText>

      {canManage ? (
        <Row>
          <View style={{ flex: 1 }}>
            <TextField
              value={text}
              onChangeText={(value) => {
                setText(value);
                setSaved(false);
                setError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              accessibilityLabel={`${strings.BUDGET} ${category.name}`}
              error={invalid ? strings.FORM_ERRORS.AMOUNT_INVALID : null}
            />
          </View>

          <Button
            label={saved ? strings.BUDGET_SAVED : strings.SAVE}
            loading={busy}
            disabled={invalid || unchanged}
            onPress={save}
          />
        </Row>
      ) : null}

      <ErrorBanner message={error} />
    </Card>
  );
}