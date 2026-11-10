import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../../theme";

export const Wrap = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacing.sm}px;
`;

export const Chip = styled.Pressable<{ $selected: boolean }>`
  border-radius: ${radius.pill}px;
  border-width: 1px;
  border-color: ${({ $selected }) => ($selected ? colors.primary : colors.border)};
  background-color: ${({ $selected }) => ($selected ? colors.primary : colors.surface)};
  padding-vertical: ${spacing.xs + 2}px;
  padding-horizontal: ${spacing.md}px;
`;

export const ChipLabel = styled.Text<{ $selected: boolean }>`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${({ $selected }) => ($selected ? colors.surface : colors.text)};
`;
