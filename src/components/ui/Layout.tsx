import type { ReactNode } from "react";
import { RefreshControl, StyleSheet } from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

const Scroll = styled.ScrollView.attrs<{ $insets: EdgeInsets; $withTopInset: boolean }>(
  ({ $insets, $withTopInset }) => ({
    contentContainerStyle: {
      gap: spacing.md,
      paddingTop: ($withTopInset ? $insets.top : 0) + spacing.lg,
      paddingBottom: $insets.bottom + spacing.xl * 3,
      paddingLeft: $insets.left + spacing.lg,
      paddingRight: $insets.right + spacing.lg,
    },
    keyboardShouldPersistTaps: "handled",
  }),
)`
  flex: 1;
  background-color: ${colors.background};
`;

interface ScrollScreenProps {
  children: ReactNode;
  /** Screens without a navigation header must pad for the status bar themselves. */
  withTopInset?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function ScrollScreen({ children, withTopInset = false, refreshing = false, onRefresh }: ScrollScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <Scroll
      $insets={insets}
      $withTopInset={withTopInset}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </Scroll>
  );
}

export const Card = styled.View`
  background-color: ${colors.surface};
  border-radius: ${radius.md}px;
  border-width: ${StyleSheet.hairlineWidth}px;
  border-color: ${colors.border};
  padding: ${spacing.lg}px;
  gap: ${spacing.md}px;
`;

export const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${spacing.sm}px;
`;

export const SpaceBetweenRow = styled(Row)`
  justify-content: space-between;
`;

export const Title = styled.Text`
  font-size: ${fontSize.title}px;
  font-weight: 700;
  color: ${colors.text};
  text-align: center;
`;

export const SectionTitle = styled.Text`
  font-size: ${fontSize.heading}px;
  font-weight: 700;
  color: ${colors.text};
  margin-top: ${spacing.sm}px;
`;

export const BodyText = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.text};
`;

export const MutedText = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.textMuted};
`;
