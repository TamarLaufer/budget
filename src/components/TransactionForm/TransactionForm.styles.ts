import { styled } from "styled-components/native";
import { colors, fontSize, spacing } from "../../theme";

export const FieldLabel = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${colors.textMuted};
  padding: 8px 0;
`;

export const FieldError = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.danger};
`;

export const Field = styled.View`
  gap: ${spacing.xs}px;
`;

export const ButtonContainer = styled.View`
    padding: 20px 0 0 0;
`