import React from "react";
import { Text } from "../../src/typography";
import { useWindowDimensions } from "react-native";
import { colors } from "../../src/theme";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfessionalNavigation } from "../../src/professional-navigation";
import { Icon, type IconName } from "../../src/icons";
import { confirmPendingNavigation } from "../../src/unsaved-changes";
export default function Layout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isAdministrator = useProfessionalNavigation();
  const compact = width < 420;
  const tabs: [string, string, IconName][] = [
    ["index", "Il mio percorso", "home"],
    ["discover", "Argomenti", "discover"],
    ["checklists", "Checklist", "checklist"],
    ["shop", "Consigli d’acquisto", "shop"],
    ["profile", "Profilo", "profile"],
    ["studio", "Studio", "studio"],
  ];
  return (
    <Tabs
      screenListeners={({ navigation }) => ({
        tabPress: (event) => {
          const state = navigation.getState();
          if (state.routes[state.index]?.key === event.target) return;
          if (!confirmPendingNavigation()) event.preventDefault();
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: "below-icon",
        tabBarActiveTintColor: "#42624B",
        tabBarInactiveTintColor: "#67736C",
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          paddingHorizontal:
            width >= 900 ? Math.max(24, (width - 1100) / 2) : 8,
          height: 72 + Math.max(12, insets.bottom),
          paddingBottom: Math.max(12, insets.bottom),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: compact ? 10 : 12,
          fontFamily: "NidoSansSemibold",
        },
        tabBarActiveBackgroundColor: colors.sagePale,
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: compact ? 0 : 3,
        },
      }}
    >
      {tabs.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            ...(name === "studio" && !isAdministrator
              ? {
                  tabBarItemStyle: { display: "none" as const },
                  tabBarButton: () => null,
                }
              : {}),
            title,
            tabBarLabel: ({ color, focused }) => (
              <Text
                numberOfLines={2}
                style={{
                  width: "100%",
                  textAlign: "center",
                  color,
                  fontSize: compact ? (isAdministrator ? 10 : 11) : 12,
                  fontFamily: focused ? "NidoSansBold" : "NidoSans",
                  marginHorizontal: 0,
                  lineHeight: 14,
                  minHeight: 28,
                }}
              >
                {name === "index"
                  ? "Percorso"
                  : name === "shop"
                    ? "Consigli\nd’acquisto"
                    : title}
              </Text>
            ),
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color }) => (
              <Icon
                name={icon}
                size={compact ? 21 : 23}
                color={String(color)}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
