import { Text } from "react-native";
import { Chip, ChipLabel, Wrap } from "./ChipGroup.styles";


export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: readonly ChipOption<T>[];
  selected: T | null;
  text?: string;
  onSelect: (value: T) => void;
}

/** Single-choice selector rendered as wrapping chips (used instead of native pickers). */
export function ChipGroup<T extends string>({ options, selected, text, onSelect }: ChipGroupProps<T>) {
  return (
    <Wrap accessibilityRole="radiogroup">
      {text && <Text>{text}</Text>}
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
