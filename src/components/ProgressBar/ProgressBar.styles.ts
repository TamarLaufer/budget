import { styled } from "styled-components/native";

import { colors, radius } from "../../theme";

export const Track = styled.View`
  height: 10px;
  border-radius: ${radius.pill}px;
  background-color: ${colors.track};
  overflow: hidden;
`;

interface FillPropsType {
  $isOver: boolean;
}

export const Fill = styled.View<FillPropsType>`
  height: 100%;
  border-radius: ${radius.pill}px;
  background-color: ${({ $isOver }) => $isOver ? colors.danger : colors.primary};
`;
