import styled from "styled-components/native";
import { colors, fontSize, spacing } from "../../theme";

export const HeaderContainer = styled.Text`
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

export const Month = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.textMuted};
`;