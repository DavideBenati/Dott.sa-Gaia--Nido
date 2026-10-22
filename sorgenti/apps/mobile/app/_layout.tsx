import React from "react";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../src/state";
function Navigation() {
  const { ready } = useApp();
  return ready ? (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
      }}
    />
  ) : (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <ActivityIndicator color="#42624B" />
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}
