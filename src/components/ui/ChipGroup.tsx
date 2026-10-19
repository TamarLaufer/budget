import { styled } from "styled-components/native";

import { colors, fontSize, radius, spacing } from "../../theme";

const Wrap = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacing.sm}px;
`;

const Chip = styled.Pressable<{ $selected: boolean }>`
  border-radius: ${radius.pill}px;
  border-width: 1px;
  border-color: ${({ $selected }) => ($selected ? colors.primary : colors.border)};
  background-color: ${({ $selected }) => ($selected ? colors.primary : colors.surface)};
  padding-vertical: ${spacing.xs + 2}px;
  padding-horizontal: ${spacing.md}px;
`;

const ChipLabel = styled.Text<{ $selected: boolean }>`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${({ $selected }) => ($selected ? colors.surface : colors.text)};
`;

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: readonly ChipOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
}

/** Single-choice selector rendered as wrapping chips (used instead of native pickers). */
export function ChipGroup<T extends string>({ options, selected, onSelect }: ChipGroupProps<T>) {
  return (
    <Wrap accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Chip
            key={option.value}
            $selected={isSelected}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <ChipLabel $selected={isSelected}>{option.label}</ChipLabel>
          </Chip>
        );
      })}
    </Wrap>
  );
}
