import { Circle, CircleContainer, CircleText, RangeContainer } from "./RangeMergePracticeScreen.styles";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const CIRCLES = [0, 1, 2, 3, 4, 5, 6];
const CIRCLE_SIZE = 35;
const GAP = 12;
const STEP = GAP + CIRCLE_SIZE;
const CAPSULE_OPACITY = 0.7;
const GROW_DURATION_MS = 220;

const RangeMergePracticeScreen = () => {
  const inRange = true;

  const selectedStartIndex = useSharedValue<null | number>(null);
  const selectedEndIndex = useSharedValue<null | number>(null);

  const capsuleX = useSharedValue<number>(0);
  const capsuleWidth = useSharedValue(CIRCLE_SIZE);
  const capsuleVisibility = useSharedValue(0);

  // get()/set() instead of `.value` on the JS thread keeps this React Compiler compatible.
  const resetSelections = () => {
    selectedStartIndex.set(null);
    selectedEndIndex.set(null);
    capsuleX.set(0);
    capsuleWidth.set(CIRCLE_SIZE);
    capsuleVisibility.set(0);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: capsuleX.value }],
      opacity: capsuleVisibility.value,
      backgroundColor: "orange",
      width: capsuleWidth.value,
    };
  });

  const onCirclePress = (userSelection: number) => {
    const start = selectedStartIndex.get();
    const end = selectedEndIndex.get();

    if (start === null) {
      selectedStartIndex.set(userSelection);
      capsuleX.set(userSelection * STEP);
      capsuleVisibility.set(CAPSULE_OPACITY);
    } else if (end === null) {
      selectedEndIndex.set(userSelection);
      const distanceBetweenIndexes = userSelection - start;
      const newWidth = Math.abs(distanceBetweenIndexes) * STEP + CIRCLE_SIZE;

      if (distanceBetweenIndexes >= 0) {
        capsuleWidth.set(newWidth);
      } else {
        // Grow leftwards: move the capsule start while widening it.
        const growBy = newWidth - CIRCLE_SIZE;
        capsuleX.set(withTiming(capsuleX.get() - growBy, { duration: GROW_DURATION_MS }));
        capsuleWidth.set(withTiming(newWidth, { duration: GROW_DURATION_MS }));
      }
    } else {
      resetSelections();
    }
  };

  return (
    <RangeContainer gap={GAP}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            position: "absolute",
            borderRadius: CIRCLE_SIZE / 2,
            top: 30,
            left: 22,
            zIndex: 100,
          },
          animatedStyle,
        ]}
      />
      {CIRCLES.map((circle) => {
        return (
          <CircleContainer key={circle}>
            <Circle onPress={() => onCirclePress(circle)} $circleSize={CIRCLE_SIZE} $inRange={inRange}>
              <CircleText>{circle}</CircleText>
            </Circle>
          </CircleContainer>
        );
      })}
    </RangeContainer>
  );
};

export default RangeMergePracticeScreen;
