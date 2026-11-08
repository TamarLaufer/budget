import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

export const CategoryName = styled.Text`
  font-size: ${fontSize.heading}px;
  font-weight: 700;
  color: ${colors.text};
`;

export const ChipsContainer = styled.View`
  direction: rtl;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacing.sm}px;
`;

interface ChipProps {
  /** Inactive subcategories get an outlined, dashed look and muted text. */
  $inactive: boolean;
  /** The chip whose editor is open. */
  $selected: boolean;
}

/**
 * Subcategory chip (ChipGroup's chips are single-choice radio buttons, which these are not).
 * Pressable for managers, who tap it to edit; plain for everyone else.
 */
export const Chip = styled.Pressable<ChipProps>`
  background-color: ${({ $inactive }) => ($inactive ? colors.surface : colors.selected)};
  border-radius: ${radius.pill}px;
  border-width: 1px;
  border-style: ${({ $inactive }) => ($inactive ? "dashed" : "solid")};
  border-color: ${({ $inactive, $selected }) =>
    $selected ? colors.primary : $inactive ? colors.textMuted : colors.selected};
  padding-vertical: ${spacing.xs}px;
  padding-horizontal: ${spacing.md}px;
`;

export const ChipLabel = styled.Text<{ $inactive: boolean }>`
  color: ${({ $inactive }) => ($inactive ? colors.textMuted : colors.text)};
  font-size: ${fontSize.caption}px;
`;

export const GroupLabel = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${colors.textMuted};
`;

/** Name field and Add button side by side, the button aligned with the input (not its label). */
export const AddRow = styled.View`
  flex-direction: row;
  align-items: flex-end;
  gap: ${spacing.sm}px;
`;

export const AddField = styled.View`
  flex: 1;
`;
