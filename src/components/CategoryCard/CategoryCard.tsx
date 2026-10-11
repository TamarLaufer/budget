import { formatAgorot } from "../../budget/money";
import type { CategorySummary } from "../../budget/types";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import {
  Card,
  DetailLabel,
  DetailRow,
  DetailValue,
  HeaderRow,
  Name,
  OverBadge,
  OverBadgeText,
  Percent,
  Status,
  OverBadgeContainer
} from "./CategoryCard.styles";
import { ProgressBar } from "../ProgressBar/ProgressBar";
import {useSharedValue} from 'react-native-reanimated';

interface CategoryCardProps {
  category: CategorySummary;
  onPress: ()=> void;
  isSelected: boolean;
}

export function CategoryCard({ category, onPress, isSelected }: CategoryCardProps) {
  const { name, budget, spent, remaining, percentUsed, fill, isOver } = category;

  const scale = useSharedValue(1)
  console.log(scale.value, 'scale');
  

  return (
    <Card $isOver={isOver} onPress={onPress} isSelected={isSelected}>
      <HeaderRow>
        <Name>{name}</Name>
    
        {isOver ? (
          <OverBadgeContainer>
            <OverBadge>
              <OverBadgeText>{strings.OVER_BUDGET}</OverBadgeText>
            </OverBadge>
          </OverBadgeContainer>
        ) : null}

      </HeaderRow>

      <DetailRow>
        <DetailLabel>{strings.BUDGET}</DetailLabel>
        <DetailValue>{formatAgorot(budget)}</DetailValue>
      </DetailRow>
      <DetailRow>
        <DetailLabel>{strings.EXPENSES}</DetailLabel>
        <DetailValue>{formatAgorot(spent)}</DetailValue>
      </DetailRow>

      <ProgressBar fill={fill} percentUsed={percentUsed} isOver={isOver} />

      <DetailRow>
        <Status $isOver={isOver}>
          {isOver
            ? format(strings.OVER_BY, { amount: formatAgorot(-remaining) })
            : format(strings.REMAINING, { amount: formatAgorot(remaining) })}
        </Status>
        <Percent $isOver={isOver}>{format(strings.PERCENT, { percent: percentUsed })}</Percent>
      </DetailRow>
    </Card>
  );
}
