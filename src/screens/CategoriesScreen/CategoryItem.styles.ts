import { StyleSheet } from "react-native";
import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

/** A compact, tappable list row. The app forces RTL, so the name starts on the right. */
export const RowPressable = styled.Pressable<{ $pressed: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm}px;
  background-color: ${({ $pressed }) => ($pressed ? colors.selected : colors.surface)};
  border-radius: ${radius.md}px;
  border-width: ${StyleSheet.hairlineWidth}px;
  border-color: ${colors.border};
  padding-vertical: ${spacing.md}px;
  padding-horizontal: ${spacing.lg}px;
`;

export const RowName = styled.Text`
  flex: 1;
  font-size: ${fontSize.body}px;
  font-weight: 600;
  color: ${colors.text};
`;
