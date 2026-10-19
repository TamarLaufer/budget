import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform } from "react-native";
import { styled } from "styled-components/native";

import { fromDateOnly, toDateOnly } from "../../budget/period";
import { colors, fontSize, radius, spacing } from "../../theme";

const Wrapper = styled.View`
  gap: ${spacing.xs}px;
`;

const Label = styled.Text`
  font-size: ${fontSize.caption}px;
  font-weight: 600;
  color: ${colors.textMuted};
`;

const Field = styled.Pressable`
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: ${radius.sm}px;
  padding: ${spacing.md}px;
`;

const Value = styled.Text`
  font-size: ${fontSize.body}px;
  color: ${colors.text};
`;

/** Shows "DD/MM/YYYY", the common Israeli format. */
function display(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-");
  return `${d}/${m}/${y}`;
}

interface DateFieldProps {
  label: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    setIosOpen(false);
    if (event.type === "set" && date) onChange(toDateOnly(date));
  };

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: fromDateOnly(value), mode: "date", onChange: handleChange });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <Wrapper>
      <Label>{label}</Label>
      <Field onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${display(value)}`}>
        <Value>{display(value)}</Value>
      </Field>
      {iosOpen ? <DateTimePicker value={fromDateOnly(value)} mode="date" onChange={handleChange} /> : null}
    </Wrapper>
  );
}
