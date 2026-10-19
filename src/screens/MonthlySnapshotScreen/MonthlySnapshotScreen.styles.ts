import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

export const SectionTitleContainer = styled.View`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const SectionTitle = styled.Text`
  font-size: ${fontSize.heading}px;
  font-weight: 700;
  color: ${colors.text};
  margin-top: ${spacing.md}px;
  padding-end: 10px;
`;

export const ShowAllPress = styled.Pressable`
  background-color: ${colors.offwhite};
  padding: ${spacing.sm}px;
  border-radius: 25px;
  display: flex;
  width: 60%;
  align-self: center;
  justify-content: center;
  align-items: center;
`;

export const ShowAllText = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.text};
`;

export const IncomeRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  background-color: ${colors.surface};
  border-radius: ${radius.md}px;
  padding: ${spacing.md}px;
  gap: ${spacing.xs}px;
`;

export const IncomeLabel = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.textMuted};
`;

export const IncomeValue = styled.Text<{ $color: string }>`
  font-size: ${fontSize.body}px;
  font-weight: 700;
  color: ${({ $color }) => $color};
`;
