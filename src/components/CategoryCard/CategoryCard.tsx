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
import Animated, {useAnimatedStyle, useSharedValue, withSequence, withTiming} from 'react-native-reanimated';
import { useEffect } from "react";

interface CategoryCardProps {
  category: CategorySummary;
  onPress: ()=> void;
  isSelected: boolean;
}

const AnimatedCard = Animated.createAnimatedComponent(Card);

export function CategoryCard({ category, onPress, isSelected }: CategoryCardProps) {
  const { name, budget, spent, remaining, percentUsed, fill, isOver } = category;

  const scale = useSharedValue(1)
  const elevation = useSharedValue(0);
  const position = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
  return {
    transform: [{ scale: scale.value}, {translateX: position.value }],
    elevation: elevation.value,
  };
});
  
useEffect(() => {
  scale.value = withTiming(isSelected ? 1.04 : 1, {
    duration: 230,
  }),

  elevation.value = withTiming(isSelected ? 8 : 0, {
    duration: 180, 
  });

  position.value = withTiming(isSelected ? 8 : 0, {
    duration: 230,
  });

}, [isSelected]);


  return (
    <AnimatedCard $isOver={isOver} onPress={onPress} isSelected={isSelected} style={animatedStyle}>
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
    </AnimatedCard>
  );
}
