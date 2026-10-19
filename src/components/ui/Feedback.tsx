import { ActivityIndicator } from "react-native";
import { styled } from "styled-components/native";

import { strings } from "../../strings/he";
import { colors, fontSize, radius, spacing } from "../../theme";
import { Button } from "./Button";

const Centered = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: ${spacing.md}px;
  padding: ${spacing.xl}px;
  background-color: ${colors.background};
`;

const Message = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.textMuted};
  text-align: center;
`;

export function LoadingView({ message = strings.LOADING }: { message?: string }) {
  return (
    <Centered accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Message>{message}</Message>
    </Centered>
  );
}

/** Full-screen error with an optional retry. */
export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Centered>
      <Message accessibilityRole="alert">{message}</Message>
      {onRetry ? <Button label={strings.RETRY} onPress={onRetry} /> : null}
    </Centered>
  );
}

const Banner = styled.View<{ $tone: "error" | "info" }>`
  background-color: ${({ $tone }) => ($tone === "error" ? colors.dangerSurface : colors.selected)};
  border-radius: ${radius.md}px;
  padding: ${spacing.md}px;
  gap: ${spacing.sm}px;
`;

const BannerText = styled.Text<{ $tone: "error" | "info" }>`
  font-size: ${fontSize.body}px;
  color: ${({ $tone }) => ($tone === "error" ? colors.danger : colors.text)};
`;

/** Inline error, e.g. above a form. */
export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <Banner $tone="error" accessibilityRole="alert">
      <BannerText $tone="error">{message}</BannerText>
      {onRetry ? <Button label={strings.RETRY} variant="secondary" compact onPress={onRetry} /> : null}
    </Banner>
  );
}

export function InfoBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Banner $tone="info" accessibilityLiveRegion="polite">
      <BannerText $tone="info">{message}</BannerText>
    </Banner>
  );
}

const Empty = styled.View`
  align-items: center;
  padding: ${spacing.xl}px;
  gap: ${spacing.xs}px;
`;

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Empty>
      <Message>{title}</Message>
      {hint ? <Message>{hint}</Message> : null}
    </Empty>
  );
}
