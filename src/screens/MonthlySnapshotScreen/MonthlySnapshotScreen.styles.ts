import type { EdgeInsets } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import { colors, fontSize, spacing } from "../../theme";

export const Screen = styled.ScrollView.attrs<{ $insets: EdgeInsets }>(
  ({ $insets }) => ({
    contentContainerStyle: {
      gap: spacing.md,
      paddingTop: $insets.top + spacing.lg,
      paddingBottom: $insets.bottom + spacing.xl,
      paddingLeft: $insets.left + spacing.lg,
      paddingRight: $insets.right + spacing.lg,
    },
  }),
)`
  flex: 1;
  background-color: ${colors.background};
`;

export const Header = styled.View`
  gap: ${spacing.xs}px;
  margin-bottom: ${spacing.sm}px;
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

export const SectionTitle = styled.Text`
  font-size: ${fontSize.heading}px;
  font-weight: 700;
  color: ${colors.text};
  margin-top: ${spacing.md}px;
`;
