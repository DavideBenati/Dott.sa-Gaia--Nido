import NidoLora from "../assets/fonts/Lora_400Regular.ttf";
import NidoLoraItalic from "../assets/fonts/Lora_400Regular_Italic.ttf";
import NidoSans from "../assets/fonts/DMSans_400Regular.ttf";
import NidoSansMedium from "../assets/fonts/DMSans_500Medium.ttf";
import NidoSansSemibold from "../assets/fonts/DMSans_600SemiBold.ttf";
import NidoSansBold from "../assets/fonts/DMSans_700Bold.ttf";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../src/state";
import { consumeAccountEntry } from "../src/entry-navigation";
import { UnsavedNavigationGuard } from "../src/unsaved-changes";
function Navigation() {
  const { ready, email, passwordRecovery, state, updatePreferences } = useApp();
  useEffect(() => {
    if (!ready || !email || passwordRecovery) return;
    const entry = consumeAccountEntry(email);
    if (!entry) return;
    const open = () => router.replace("/gaia?start=1");
    if (!entry.journey) {
      open();
      return;
    }
    void updatePreferences({
      ...state.preferences,
      journey: entry.journey === "exploring" ? "pregnancy" : entry.journey,
      exploreOnly: entry.journey === "exploring",
      personalized: false,
      sensitiveConsent: false,
      date: null,
    }).then(open, open);
  }, [ready, email, passwordRecovery, state.preferences, updatePreferences]);
  return ready ? (
    <>
      <UnsavedNavigationGuard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FAF7F2" },
        }}
      />
    </>
  ) : (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <ActivityIndicator color="#42624B" />
    </View>
  );
}
export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    NidoLora: NidoLora,
    NidoLoraItalic: NidoLoraItalic,
    NidoSans: NidoSans,
    NidoSansMedium: NidoSansMedium,
    NidoSansSemibold: NidoSansSemibold,
    NidoSansBold: NidoSansBold,
  });
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: "#FAF7F2",
        }}
      >
        <ActivityIndicator
          accessibilityLabel="Caricamento MAIA"
          color="#42624B"
        />
      </View>
    );
  // A font download failure must not block access; use the system fallback.
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}
