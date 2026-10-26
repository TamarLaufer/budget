
import { styled } from "styled-components/native";
import { colors, fontSize, radius, spacing } from "../../theme";

export const HeaderContainer = styled.View`
  gap: ${spacing.md}px;
  margin-bottom: ${spacing.lg}px;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding-top: ${spacing.sm}px;
`;

export const Title = styled.Text`
  font-size: ${fontSize.title}px;
  font-weight: 800;
  color: ${colors.primary};
  letter-spacing: 0.5px;
`;

export const MonthRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: ${spacing.xl}px;
`;

export const Month = styled.Text`
  font-size: ${fontSize.value}px;
  font-weight: 700;
  color: ${colors.text};
  min-width: 125px;
  text-align: center;
`;

export const NavButton = styled.Pressable`
  background-color: ${colors.surface};
  border-radius: ${radius.pill}px;
  border-width: 1px;
  border-color: ${colors.border};
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
`;

export const NavText = styled.Text`
  font-size: ${fontSize.heading}px;
  color: ${colors.primary};
  font-weight: 700;
  text-align: center;
  text-align-vertical: center;
  include-font-padding: false;
  line-height: 26px;
`;
