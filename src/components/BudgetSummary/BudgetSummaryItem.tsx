import { colors } from "@/theme";
import { Item, ItemLabel, ItemValue } from "./BudgetSummary.styles";

interface SummaryItemProps {
  label: string;
  value: string;
  color?: string;
}

function SummaryItem({ label, value, color = colors.text }: SummaryItemProps) {
  return (
    <Item>
      <ItemLabel>{label}</ItemLabel>
      <ItemValue $color={color} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </ItemValue>
    </Item>
  );
}

export default SummaryItem;