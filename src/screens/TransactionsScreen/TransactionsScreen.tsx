import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import type { TransactionDto, TransactionType } from "../../../shared/api";
import { errorMessage } from "../../api/errorMessage";
import { filterTransactions, noFilters, type TransactionFilters } from "../../budget/filters";
import { periodToDate } from "../../budget/period";
import Header from "../../components/Header/Header";
import { Button } from "../../components/ui/Button";
import { ChipGroup, type ChipOption } from "../../components/ui/ChipGroup";
import { EmptyState, ErrorBanner, ErrorView, LoadingView } from "../../components/ui/Feedback";
import { TextField } from "../../components/ui/TextField";
import { TransactionRow } from "../../components/TransactionRow/TransactionRow";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePeriodData } from "../../hooks/usePeriodData";
import { useAppDispatch, useAppSelector } from "../../store";
import { categorySelectors, selectTransactionsForPeriod } from "../../store/selectors";
import { periodShifted } from "../../store/slices/periodSlice";
import { strings } from "../../strings/he";
import { colors, spacing } from "../../theme";

const Filters = styled.View`
  gap: ${spacing.sm}px;
  margin-bottom: ${spacing.sm}px;
`;

const Separator = styled.View`
  height: ${spacing.sm}px;
`;

const ALL = "__all__";

export default function TransactionsScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { period, load, refresh, refreshing } = usePeriodData();
  const transactions = useAppSelector(selectTransactionsForPeriod);
  const categories = useAppSelector(categorySelectors.selectAll);
  const memberCount = useAppSelector((s) => s.household.members.length);

  const [filters, setFilters] = useState<TransactionFilters>(noFilters);
  const query = useDebouncedValue(filters.query);

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const visible = useMemo(
    () => filterTransactions(transactions, { ...filters, query }, categoryNames),
    [transactions, filters, query, categoryNames],
  );

  const typeOptions: ChipOption<string>[] = [
    { value: ALL, label: strings.ALL },
    { value: "EXPENSE", label: strings.TYPE_EXPENSE },
    { value: "INCOME", label: strings.TYPE_INCOME },
  ];
  const categoryOptions: ChipOption<string>[] = [
    { value: ALL, label: strings.ALL },
    ...categories.filter((c) => c.isActive || transactions.some((t) => t.categoryId === c.id)).map((c) => ({ value: c.id, label: c.name })),
  ];

  const openTransaction = useCallback((id: string) => router.push(`/transaction/${id}`), []);
  const renderItem = useCallback(
    ({ item }: { item: TransactionDto }) => (
      <TransactionRow
        transaction={item}
        categoryName={item.categoryId ? (categoryNames.get(item.categoryId) ?? null) : null}
        showCreator={memberCount > 1}
        onPress={openTransaction}
      />
    ),
    [categoryNames, memberCount, openTransaction],
  );

  if (!load.loaded && load.status === "failed") {
    return <ErrorView message={errorMessage(load.error)} onRetry={refresh} />;
  }
  if (!load.loaded) return <LoadingView />;

  const header = (
    <Filters>
      <Header
        title={strings.TAB_TRANSACTIONS}
        month={periodToDate(period)}
        onPrevious={() => dispatch(periodShifted(-1))}
        onNext={() => dispatch(periodShifted(1))}
      />
      <ErrorBanner message={load.status === "failed" ? errorMessage(load.error) : null} onRetry={refresh} />
      <Button label={strings.ADD_TRANSACTION} onPress={() => router.push("/transaction/new")} />
      <TextField
        placeholder={strings.SEARCH}
        value={filters.query}
        onChangeText={(text) => setFilters((f) => ({ ...f, query: text }))}
        accessibilityLabel={strings.SEARCH}
      />
      <ChipGroup
        options={typeOptions}
        selected={filters.type ?? ALL}
        onSelect={(v) => setFilters((f) => ({ ...f, type: v === ALL ? null : (v as TransactionType) }))}
      />
      <ChipGroup
        options={categoryOptions}
        selected={filters.categoryId ?? ALL}
        onSelect={(v) => setFilters((f) => ({ ...f, categoryId: v === ALL ? null : v }))}
      />
    </Filters>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xl * 3,
        paddingHorizontal: spacing.lg,
      }}
      data={visible}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title={transactions.length === 0 ? strings.NO_TRANSACTIONS : strings.NO_MATCHING_TRANSACTIONS} />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
    />
  );
}
