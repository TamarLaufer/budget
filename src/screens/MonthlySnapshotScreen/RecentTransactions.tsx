import { router } from "expo-router";
import { useCallback } from "react";

import type { TransactionDto } from "../../../shared/api";
import { TransactionRow } from "../../components/TransactionRow/TransactionRow";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Feedback";
import { useAppDispatch, useAppSelector } from "../../store";
import { categorySelectors, subCategorySelectors } from "../../store/selectors";
import { transactionFiltersCleared } from "../../store/slices/transactionsSlice";
import { strings } from "../../strings/he";
import { RecentContent, RecentList, SectionTitle, SectionTitleContainer } from "./MonthlySnapshotScreen.styles";

interface RecentTransactionsProps {
  /** The selected month's newest transactions, newest first. */
  transactions: readonly TransactionDto[];
}

/** The month's latest transactions on the dashboard, with a link to the full list. */
export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(categorySelectors.selectEntities);
  const subCategories = useAppSelector(subCategorySelectors.selectEntities);
  const showCreator = useAppSelector((s) => s.household.members.length > 1);

  const openTransaction = useCallback((id: string) => router.push(`/transaction/${id}`), []);

  // The list keeps the selected month (it is shared app state); only its search and filters reset.
  const viewAll = () => {
    dispatch(transactionFiltersCleared());
    router.navigate("/transactions");
  };

  return (
    <>
      <SectionTitleContainer>
        <SectionTitle accessibilityRole="header">{strings.RECENT_TRANSACTIONS}</SectionTitle>
      </SectionTitleContainer>

      {transactions.length === 0 ? (
        <EmptyState title={strings.NO_TRANSACTIONS} />
      ) : (
        <>
{transactions.length === 0 ? (
  <EmptyState title={strings.NO_TRANSACTIONS} />
) : (
    <RecentContent>
      <RecentList testID="recent-transactions">
        {transactions.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            categoryName={
              t.categoryId ? (categories[t.categoryId]?.name ?? null) : null
            }
            subCategoryName={
              t.subCategoryId
                ? (subCategories[t.subCategoryId]?.name ?? null)
                : null
            }
            showCreator={showCreator}
            onPress={openTransaction}
          />
        ))}
      </RecentList>

      <Button
        label={strings.VIEW_ALL_TRANSACTIONS}
        variant="link"
        compact
        onPress={viewAll}
        testID="view-all-transactions"
        style={{
          alignSelf: "flex-end",
          paddingVertical: 0,
        }}
        textStyle={{
          fontWeight: "600",
          textDecorationLine: "underline",
          fontSize: 14,
        }}
        hitSlop={8}
      />
    </RecentContent>
  )}
        </>
      )}
    </>
  );
}
