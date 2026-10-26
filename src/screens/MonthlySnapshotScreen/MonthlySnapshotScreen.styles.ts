import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

export const SectionTitleContainer = styled.View`
  justify-content: center;
  align-items: center;
  padding-top: ${spacing.md}px;
`;



export const SectionTitle = styled.Text`
  font-size: ${fontSize.secondHeading}px;
  font-weight: 700;
  color: ${colors.text};
  margin-bottom: ${spacing.xs}px;
`;

export const ShowAllPress = styled.Pressable`
  background-color: ${colors.selected};
  padding-vertical: ${spacing.sm}px;
  padding-horizontal: ${spacing.xl}px;
  border-radius: ${radius.pill}px;
  border-width: 1px;
  border-color: ${colors.border};
  align-self: center;
  justify-content: center;
  align-items: center;
  min-height: 42px;
`;

export const ShowAllText = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${colors.primary};
  text-align: center;
`;

export const IncomeRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  background-color: ${colors.surface};
  border-radius: 20px;
  border-width: 1px;
  border-color: ${colors.border};
  padding: ${spacing.lg}px;
  gap: ${spacing.xs}px;
`;

export const IncomeLabel = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.textMuted};
  text-align: center;
  flex-shrink: 1;
`;

export const IncomeValue = styled.Text<{ $color: string }>`
  font-size: ${fontSize.value}px;
  font-weight: 700;
  color: ${({ $color }) => $color};
  text-align: center;
  flex-shrink: 1;
`;
