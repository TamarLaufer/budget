import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { sampleCategories } from "./src/budget/sampleData";
import { MonthlySnapshotScreen } from "./src/screens/MonthlySnapshotScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView>
        <MonthlySnapshotScreen
          categories={sampleCategories}
          month={new Date()}
        />
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
