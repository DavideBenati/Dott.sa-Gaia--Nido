import React from "react";
import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../src/icons";
export default function Layout() {
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
          backgroundColor: "#FAF7F2",
          height: 74,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      {tabs.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Icon name={icon} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
