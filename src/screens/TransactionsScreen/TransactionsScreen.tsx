import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import type { TransactionDto, TransactionType } from "../../../shared/api";
import { filterTransactions, noFilters, type TransactionFilters } from "../../budget/filters";
import { errorMessage, messageFromUnknown } from "../../api/errorMessage";
import { periodToDate } from "../../budget/period";
import Header from "../../components/Header/Header";
import { Button } from "../../components/ui/Button";
import { ChipGroup, type ChipOption } from "../../components/ui/ChipGroup/ChipGroup";
import { EmptyState, ErrorBanner, ErrorView, LoadingView } from "../../components/ui/Feedback";
import { TextField } from "../../components/ui/TextField";
import { TransactionRow } from "../../components/TransactionRow/TransactionRow";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useScreenData } from "../../hooks/useScreenData";
import { useAppDispatch, useAppSelector } from "../../store";
import { categorySelectors, subCategorySelectors, selectTransactionsForPeriod, type Dataset } from "../../store/selectors";
import { periodShifted } from "../../store/slices/periodSlice";
import { strings } from "../../strings/he";
import { colors, radius, spacing } from "../../theme";
import { fetchSubCategories } from "../../store/slices/catalogSlices";
import { shareTransactionsExcel } from "../../budget/exportTransactions";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/** What this screen shows; loaded when missing, stale or past the freshness limit. */
const DATASETS: readonly Dataset[] = ["transactions", "categories"];

const Filters = styled.View`
  gap: ${spacing.sm}px;
  margin-bottom: ${spacing.sm}px;
`;

const Separator = styled.View`
  height: ${spacing.sm}px;
`;

const ActionsRow = styled.View`
  flex-direction: row;
  align-items: stretch;
  gap: ${spacing.sm}px;
`;

const AddAction = styled.View`
  flex: 1;
`;

const ExportAction = styled.Pressable`
  width: 48px;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: ${radius.md}px;
`;

const ALL = "__all__";

export default function TransactionsScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { period, load, refresh, refreshing } = useScreenData(DATASETS);
  const transactions = useAppSelector(selectTransactionsForPeriod);
  const categories = useAppSelector(categorySelectors.selectAll);
  const memberCount = useAppSelector((s) => s.household.members.length);
  const subCategories = useAppSelector(subCategorySelectors.selectAll);

  const [filters, setFilters] = useState<TransactionFilters>(noFilters);
  const debouncedQuery = useDebouncedValue(filters.query);
  // Clearing the search applies at once; only typing waits for the debounce.
  const query = filters.query ? debouncedQuery : "";

  // Another screen asked for the full list (e.g. the dashboard's "View all"): clear the filters.
  const filtersResetRequests = useAppSelector((s) => s.transactions.filtersResetRequests);
  const [handledResetRequests, setHandledResetRequests] = useState(filtersResetRequests);
  if (handledResetRequests !== filtersResetRequests) {
    setHandledResetRequests(filtersResetRequests);
    setFilters(noFilters);
  }

  const categoryNames = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])), 
    [categories]);
  
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

  const subCategoryNames = useMemo(
  () => new Map(subCategories.map((s) => [s.id, s.name])),
  [subCategories],
  );
  
  const renderItem = useCallback(
    ({ item }: { item: TransactionDto }) => (
      <TransactionRow
        transaction={item}
        categoryName={item.categoryId ? (categoryNames.get(item.categoryId) ?? null) : null}
        subCategoryName={item.subCategoryId ? (subCategoryNames.get(item.subCategoryId) ?? null): null}
        showCreator={memberCount > 1}
        onPress={openTransaction}
      />
    ),
    [categoryNames, subCategoryNames, memberCount, openTransaction],
  );

  const categoryIdsForSubCategories = useMemo(() => {
  const ids = new Set<string>();

  for (const transaction of transactions) {
      if (transaction.categoryId && transaction.subCategoryId) {
        ids.add(transaction.categoryId);
      }
    }

    return [...ids];
  }, [transactions]);

  useFocusEffect(
    useCallback(() => {
      for (const categoryId of categoryIdsForSubCategories) {
        void dispatch(fetchSubCategories(categoryId));
      }
    }, [dispatch, categoryIdsForSubCategories]),
  );

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportInProgress = useRef(false);

  const exportExcel = async () => {
    if (exportInProgress.current) return;

    exportInProgress.current = true;
    setExporting(true);
    setExportError(null);

    try {
      await shareTransactionsExcel();
    } catch (error) {
      setExportError(messageFromUnknown(error));
    } finally {
      exportInProgress.current = false;
      setExporting(false);
    }
  };

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
      titleAction={
        <ExportAction
          onPress={() => void exportExcel()}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel={strings.EXPORT_EXCEL}
          accessibilityState={{ disabled: exporting, busy: exporting }}
          testID="export-transactions"
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#16A34A" />
          ) : (
            <MaterialCommunityIcons
              name="microsoft-excel"
              size={26}
              color="#16A34A"
            />
          )}
        </ExportAction>
      }
    />
      <ErrorBanner message={load.status === "failed" ? errorMessage(load.error) : null} onRetry={refresh} />
      <Button label={strings.ADD_TRANSACTION} onPress={() => router.push("/transaction/new")} />

      <ErrorBanner message={exportError} />
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
        text={strings.TRANSACTION_TYPE}
      />
      <ChipGroup
        options={categoryOptions}
        selected={filters.categoryId ?? ALL}
        onSelect={(v) => setFilters((f) => ({ ...f, categoryId: v === ALL ? null : v }))}
        text={strings.CATEGORY}
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
