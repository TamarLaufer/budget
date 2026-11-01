import { formatAgorot } from "../../budget/money";
import type { BudgetUsage } from "../../budget/types";
import { colors } from "../../theme";
import { Caption, Card, Row } from "./BudgetSummary.styles";
import { ProgressBar } from "../ProgressBar/ProgressBar";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import SummaryItem from "./BudgetSummaryItem";

interface BudgetSummaryProps {
  totals: BudgetUsage;
}

export function BudgetSummary({ totals }: BudgetSummaryProps) {
  const balanceLabel = totals.isOver ? strings.OVER : strings.BALANCE;
  const balanceColor = totals.isOver ? colors.danger : colors.success;

  return (
    <Card>
      <Row>
        <SummaryItem label={strings.TOTAL_BUDGET} value={formatAgorot(totals.budget)} />
        <SummaryItem label={strings.EXPENSES} value={formatAgorot(totals.spent)} />
        <SummaryItem
          label={balanceLabel}
          value={formatAgorot(Math.abs(totals.remaining))}
          color={balanceColor}
        />
      </Row>
      <ProgressBar fill={totals.fill} percentUsed={totals.percentUsed} isOver={totals.isOver} />
      <Caption>{format(strings.BUDGET_USED, { percent: totals.percentUsed })}</Caption>
    </Card>
  );
}