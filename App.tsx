import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { sampleCategories } from "./src/budget/sampleData";
import MonthlySnapshotScreen from "./src/screens/MonthlySnapshotScreen/MonthlySnapshotScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      <SafeAreaView style={{ flex: 1 }}>
        <MonthlySnapshotScreen
          categories={sampleCategories}
          month={new Date()}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}