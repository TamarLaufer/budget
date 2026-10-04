import { styled } from "styled-components/native";

import { colors, radius } from "../../theme";

export const Track = styled.View`
  height: 10px;
  border-radius: ${radius.pill}px;
  background-color: ${colors.track};
  overflow: hidden;
`;

interface FillProps {
  /** Fill between 0 and 1. */
  $fill: number;
  $isOver: boolean;
}

export const Fill = styled.View<FillProps>`
  height: 100%;
  width: ${({ $fill }) => $fill * 100}%;
  border-radius: ${radius.pill}px;
  background-color: ${({ $isOver }) => ($isOver ? colors.danger : colors.primary)};
`;
