import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useEffect, type ComponentProps } from "react";
import { AppState, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch } from "../../store";
import { dataInvalidated } from "../../store/shared";
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
  const insets = useSafeAreaInsets();


  // Member list is needed across tabs (e.g. to show who recorded a transaction).
  useEffect(() => {
    void dispatch(fetchMembers());
  }, [dispatch]);

  // Others may have changed data while the app was in the background: refetch it on next use.
  useEffect(() => {
    let wasInBackground = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") wasInBackground = true;
      else if (state === "active" && wasInBackground) {
        wasInBackground = false;
        dispatch(dataInvalidated());
      }
    });
    return () => subscription.remove();
  }, [dispatch]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 64 + insets.bottom,
            paddingTop: 7,
            paddingBottom: 7 + insets.bottom,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "600",
      },

      tabBarIconStyle: {
        marginBottom: 2,
      },
      }}
    >
      <Tabs.Screen name="index" options={{ title: strings.TAB_DASHBOARD, tabBarIcon: tabIcon("pie-chart-outline") }} />
      <Tabs.Screen name="transactions" options={{ title: strings.TAB_TRANSACTIONS, tabBarIcon: tabIcon("list-outline") }} />
      <Tabs.Screen name="categories" options={{ title: strings.TAB_CATEGORIES, tabBarIcon: tabIcon("pricetags-outline") }} />
      <Tabs.Screen name="settings" options={{ title: strings.TAB_SETTINGS, tabBarIcon: tabIcon("settings-outline") }} />
    </Tabs>
  );
}