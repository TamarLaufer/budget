import type { TextInputProps } from "react-native";
import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

const Wrapper = styled.View`
  gap: ${spacing.xs}px;
`;

const Label = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${colors.textMuted};
`;

const Input = styled.TextInput<{ $hasError: boolean }>`
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${({ $hasError }) => ($hasError ? colors.danger : colors.border)};
  border-radius: ${radius.sm}px;
  padding-vertical: ${spacing.sm}px;
  padding-horizontal: ${spacing.md}px;
  font-size: ${fontSize.body}px;
  color: ${colors.text};
`;

const ErrorText = styled.Text`
  font-size: ${fontSize.caption}px;
  color: ${colors.danger};
`;

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return (
    <Wrapper>
      {label ? <Label>{label}</Label> : null}
      <Input
        $hasError={Boolean(error)}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <ErrorText accessibilityLiveRegion="polite">{error}</ErrorText> : null}
    </Wrapper>
  );
}
