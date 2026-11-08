import { styled } from "styled-components/native";

import { colors, radius, spacing } from "../../theme";

/** Inline editing area under the chips, framed so it reads as belonging to the tapped chip. */
export const EditorBox = styled.View`
  gap: ${spacing.sm}px;
  padding: ${spacing.md}px;
  border-radius: ${radius.md}px;
  border-width: 1px;
  border-color: ${colors.primary};
  background-color: ${colors.background};
`;

export const EditorButtons = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing.sm}px;
`;
