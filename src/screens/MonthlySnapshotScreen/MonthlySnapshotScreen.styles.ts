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

export const SectionTitle = styled.Text`
  font-size: ${fontSize.heading}px;
  font-weight: 700;
  color: ${colors.text};
  margin-top: ${spacing.md}px;
`;

export const ShowAllPress = styled.Pressable`
  background-color: ${colors.background}
  padding: 15px;
`