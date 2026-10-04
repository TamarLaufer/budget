import { StyleSheet, View } from "react-native";

import { colors, radius } from "../theme";

interface ProgressBarProps {
  /** Fill between 0 and 1. */
  fill: number;
  /** Percent shown to screen readers; may exceed 100. */
  percentUsed: number;
  isOver: boolean;
}

export function ProgressBar({ fill, percentUsed, isOver }: ProgressBarProps) {
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ text: `${percentUsed}%` }}
    >
      <View
        style={[
          styles.fill,
          { width: `${fill * 100}%`, backgroundColor: isOver ? colors.danger : colors.primary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
});
