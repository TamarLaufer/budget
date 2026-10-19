import { ActivityIndicator } from "react-native";
import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

type Variant = "primary" | "secondary" | "danger" | "link";

const background: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  danger: colors.dangerSurface,
  link: "transparent",
};

const foreground: Record<Variant, string> = {
  primary: colors.surface,
  secondary: colors.text,
  danger: colors.danger,
  link: colors.primary,
};

const Pressable = styled.Pressable<{ $variant: Variant; $disabled: boolean; $compact: boolean }>`
  background-color: ${({ $variant }) => background[$variant]};
  border-radius: ${radius.md}px;
  border-width: ${({ $variant }) => ($variant === "secondary" ? 1 : 0)}px;
  border-color: ${colors.border};
  padding-vertical: ${({ $compact }) => ($compact ? spacing.xs : spacing.md)}px;
  padding-horizontal: ${({ $compact }) => ($compact ? spacing.sm : spacing.lg)}px;
  align-items: center;
  justify-content: center;
  opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
`;

const Label = styled.Text<{ $variant: Variant; $compact: boolean }>`
  color: ${({ $variant }) => foreground[$variant]};
  font-size: ${({ $compact }) => ($compact ? fontSize.caption : fontSize.body)}px;
  font-weight: 700;
`;

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
}

export function Button({ label, onPress, variant = "primary", loading = false, disabled = false, compact = false, testID }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      $variant={variant}
      $disabled={inactive}
      $compact={compact}
      disabled={inactive}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={foreground[variant]} />
      ) : (
        <Label $variant={variant} $compact={compact}>
          {label}
        </Label>
      )}
    </Pressable>
  );
}
