import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useEffect, type ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { useAppDispatch } from "../../store";
import { fetchMembers } from "../../store/slices/householdSlice";
import { strings } from "../../strings/he";
import { colors } from "../../theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const dispatch = useAppDispatch();

  // Member list is needed across tabs (e.g. to show who recorded a transaction).
  useEffect(() => {
    void dispatch(fetchMembers());
  }, [dispatch]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: strings.TAB_DASHBOARD, tabBarIcon: tabIcon("pie-chart-outline") }} />
      <Tabs.Screen name="transactions" options={{ title: strings.TAB_TRANSACTIONS, tabBarIcon: tabIcon("list-outline") }} />
      <Tabs.Screen name="categories" options={{ title: strings.TAB_CATEGORIES, tabBarIcon: tabIcon("pricetags-outline") }} />
      <Tabs.Screen name="settings" options={{ title: strings.TAB_SETTINGS, tabBarIcon: tabIcon("settings-outline") }} />
    </Tabs>
  );
}
