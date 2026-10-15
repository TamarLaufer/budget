import { useEffect } from "react";
import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import { Fill, Track } from "./ProgressBar.styles";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface ProgressBarPropsType {
  /** Fill between 0 and 1. */
  fill: number;
  /** Percent shown to screen readers; may exceed 100. */
  percentUsed: number;
  isOver: boolean;
}

const AnimatedFill = Animated.createAnimatedComponent(Fill);

export function ProgressBar({ fill, percentUsed, isOver }: ProgressBarPropsType) {

  const animatedFill  = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedFill.value * 100}%`,
    };
  });

  useEffect(() => {
    animatedFill.value = withTiming(fill, {
      duration: 700,
    });
  }, [fill]);

  return (
    <Track
      accessibilityRole="progressbar"
      accessibilityValue={{ text: format(strings.PERCENT, { percent: percentUsed }) }}
    >
    <AnimatedFill
      $isOver={isOver}
      style={animatedStyle}
    />
    </Track>
  );
}
