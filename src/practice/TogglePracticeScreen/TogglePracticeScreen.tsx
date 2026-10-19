import { ToggleContainer, ToggleText, ToggleBall, ToggleLine } from "./TogglePracticeScreen.styles";
import { createAnimatedComponent, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

// Created once at module scope: creating components during render remounts them every render.
const AnimatedToggleBall = createAnimatedComponent(ToggleBall);

const TOGGLE_BALL_SIZE = 25;
const TOGGLE_LINE_SIZE = 120;
const TOGGLE_DURATION_MS = 370;

const TogglePracticeScreen = () => {
  const toggleX = useSharedValue(0);
  const lineLengthInAction = TOGGLE_LINE_SIZE - TOGGLE_BALL_SIZE;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: toggleX.value }],
    };
  });

  // get()/set() instead of `.value` on the JS thread keeps this React Compiler compatible.
  const onTogglePress = () => {
    toggleX.set(withTiming(toggleX.get() === 0 ? lineLengthInAction : 0, { duration: TOGGLE_DURATION_MS }));
  };

  return (
    <ToggleContainer>
      <ToggleText>לחץ לשינוי מצב</ToggleText>
      <ToggleLine $toggleLineSize={TOGGLE_LINE_SIZE}>
        <AnimatedToggleBall $toggleBallSize={TOGGLE_BALL_SIZE} onPress={onTogglePress} style={animatedStyle} />
      </ToggleLine>
    </ToggleContainer>
  );
};

export default TogglePracticeScreen;
