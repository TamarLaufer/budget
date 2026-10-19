import { memo } from "react";
import { StyleSheet } from "react-native";
import { styled } from "styled-components/native";

import type { TransactionDto } from "../../../shared/api";
import { formatAgorot } from "../../budget/money";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import { colors, fontSize, radius, spacing } from "../../theme";

const Pressable = styled.Pressable`
  background-color: ${colors.surface};
  border-radius: ${radius.md}px;
  border-width: ${StyleSheet.hairlineWidth}px;
  border-color: ${colors.border};
  padding: ${spacing.md}px;
  flex-direction: row;
  align-items: center;
  gap: ${spacing.md}px;
`;

const Main = styled.View`
  flex: 1;
  gap: 2px;
`;

const TitleText = styled.Text`
  font-size: ${fontSize.body}px;
  font-weight: 600;
  color: ${colors.text};
`;

const Meta = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.textMuted};
`;

const Amount = styled.Text<{ $income: boolean }>`
  font-size: ${fontSize.value}px;
  font-weight: 700;
  color: ${({ $income }) => ($income ? colors.success : colors.text)};
`;

function displayDate(dateOnly: string): string {
  const [, m, d] = dateOnly.split("-");
  return `${d}/${m}`;
}

interface TransactionRowProps {
  transaction: TransactionDto;
  categoryName: string | null;
  /** Shown when the household has several members, so everyone sees who recorded what. */
  showCreator: boolean;
  onPress: (id: string) => void;
}

function TransactionRowComponent({ transaction: t, categoryName, showCreator, onPress }: TransactionRowProps) {
  const isIncome = t.type === "INCOME";
  const title = t.description ?? (isIncome ? (t.incomeSource ?? strings.TYPE_INCOME) : (categoryName ?? strings.TYPE_EXPENSE));
  const creator = t.createdBy.displayName ?? t.createdBy.email.split("@")[0] ?? "";
  const meta = [displayDate(t.transactionDate), categoryName, showCreator ? format(strings.CREATED_BY, { name: creator }) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable onPress={() => onPress(t.id)} accessibilityRole="button" accessibilityHint={strings.EDIT}>
      <Main>
        <TitleText numberOfLines={1}>{title}</TitleText>
        <Meta numberOfLines={1}>{meta}</Meta>
      </Main>
      <Amount $income={isIncome}>
        {isIncome ? "+" : ""}
        {formatAgorot(t.amountAgorot)}
      </Amount>
    </Pressable>
  );
}

export const TransactionRow = memo(TransactionRowComponent);
