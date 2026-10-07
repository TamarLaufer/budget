import { StyleSheet } from "react-native";
import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

interface OverProps {
  $isOver: boolean;
  isSelected: boolean;
}

export const Card = styled.Pressable<OverProps>`
  background-color: ${({isSelected})=> (isSelected ? colors.selected : colors.border)};
  border-radius: ${radius.md}px;
  border-width: ${({ $isOver }) => ($isOver ? 1 : StyleSheet.hairlineWidth)}px;
  border-color: ${({ $isOver }) => ($isOver ? colors.danger : colors.border)};
  padding: ${spacing.lg}px;
  gap: ${spacing.sm}px;
`;

export const HeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm}px;
  margin-bottom: ${spacing.xs}px;
`;

export const Name = styled.Text`
  flex-shrink: 1;
  font-size: ${fontSize.heading}px;
  font-weight: 700;
  color: ${colors.text};
`;

export const OverBadge = styled.View`
  background-color: ${colors.dangerSurface};
  border-radius: ${radius.pill}px;
  padding-horizontal: ${spacing.md}px;
  padding-vertical: ${spacing.xs}px;
`;

export const OverBadgeText = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 700;
  color: ${colors.danger};
`;

export const DetailRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm}px;
`;

export const DetailLabel = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.textMuted};
`;

export const DetailValue = styled.Text`
  font-size: ${fontSize.body}px;
  font-weight: 600;
  color: ${colors.text};
`;

export const Status = styled.Text<Partial<OverProps>>`
  flex-shrink: 1;
  font-size: ${fontSize.body}px;
  font-weight: 700;
  color: ${({ $isOver }) => ($isOver ? colors.danger : colors.success)};
`;

export const Percent = styled.Text<Partial<OverProps>>`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${({ $isOver }) => ($isOver ? colors.danger : colors.textMuted)};
`;
