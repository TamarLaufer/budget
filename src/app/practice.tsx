import { Stack } from "expo-router";

import { ScrollScreen } from "../components/ui/Layout";
import RangeMergePracticeScreen from "../practice/RangeMergePracticeScreen/RangeMergePracticeScreen";
import TogglePracticeScreen from "../practice/TogglePracticeScreen/TogglePracticeScreen";
import { strings } from "../strings/he";

/** Development-only playground for the Reanimated practice components. */
export default function PracticeRoute() {
  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: strings.ANIMATION_PRACTICE }} />
      <RangeMergePracticeScreen />
      <TogglePracticeScreen />
    </ScrollScreen>
  );
}
