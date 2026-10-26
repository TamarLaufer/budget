
import { styled } from "styled-components/native";
import { colors, fontSize, radius, spacing } from "../../theme";

export const Wrapper = styled.View`
  gap: ${spacing.xs}px;
`;

export const Label = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${colors.textMuted};
`;

export const Field = styled.Pressable`
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: ${radius.sm}px;
  padding: ${spacing.md}px;
`;

export const Value = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.text};
`;