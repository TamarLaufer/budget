import { StyleSheet } from "react-native";
import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

export const Card = styled.View`
  background-color: ${colors.surface};
  border-radius: 20px;
  border-width: ${StyleSheet.hairlineWidth}px;
  border-color: ${colors.border};
  padding: ${spacing.xl}px;
  gap: ${spacing.lg}px;
`;

export const Row = styled.View`
  flex-direction: row;
  gap: ${spacing.md}px;
`;

export const Item = styled.View`
  flex: 1;
  align-items: center;
  gap: ${spacing.xs}px;
`;

export const ItemLabel = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.textMuted};
  text-align: center;
`;

export const ItemValue = styled.Text<{ $color: string }>`
  font-size: ${fontSize.secondHeading}px;
  font-weight: 700;
  color: ${({ $color }) => $color};
  text-align: center;
`;

export const Caption = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.textMuted};
  text-align: center;
`;
