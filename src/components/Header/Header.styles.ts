import { styled } from "styled-components/native";
import { colors, fontSize, radius, spacing } from "../../theme";

export const HeaderContainer = styled.View`
  gap: ${spacing.xs}px;
  margin-bottom: ${spacing.sm}px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

export const Title = styled.Text`
  font-size: ${fontSize.title}px;
  font-weight: 700;
  color: ${colors.text};
`;

export const MonthRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${spacing.lg}px;
`;

export const Month = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.textMuted};
  min-width: 110px;
  text-align: center;
`;

export const NavButton = styled.Pressable`
  background-color: ${colors.surface};
  border-radius: ${radius.pill}px;
  padding-vertical: ${spacing.xs}px;
  padding-horizontal: ${spacing.md}px;
`;

export const NavText = styled.Text`
  font-size: ${fontSize.value}px;
  color: ${colors.primary};
  font-weight: 700;
`;
