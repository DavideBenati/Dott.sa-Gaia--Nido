import React from "react";
import { useWindowDimensions } from "react-native";
import { colors } from "../../src/theme";
import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../src/icons";
export default function Layout() {
  const { width } = useWindowDimensions();
  const tabs: [string, string, IconName][] = [
    ["index", "Il mio percorso", "home"],
    ["discover", "Scopri", "discover"],
    ["checklists", "Checklist", "checklist"],
    ["profile", "Profilo", "profile"],
  ];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#42624B",
        tabBarInactiveTintColor: "#67736C",
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          paddingHorizontal:
            width >= 900 ? Math.max(24, (width - 1100) / 2) : 8,
          height: 74,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontFamily: "NidoSansSemibold" },
        tabBarActiveBackgroundColor: colors.sagePale,
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3 },
      }}
    >
      {tabs.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarLabel: name === "index" ? "Percorso" : title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color }) => (
              <Icon name={icon} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
