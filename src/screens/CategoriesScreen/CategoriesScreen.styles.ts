import { styled } from "styled-components/native";

import { spacing } from "../../theme";

/** Title with the small Add action beside it (the tab has no navigation header). */
export const HeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm}px;
`;

/** Rows sit closer together than the screen's own spacing between sections. */
export const RowList = styled.View`
  gap: ${spacing.sm}px;
`;
