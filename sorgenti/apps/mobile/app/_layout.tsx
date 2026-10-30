import NidoLora from "../assets/fonts/Lora_400Regular.ttf";
import NidoLoraItalic from "../assets/fonts/Lora_400Regular_Italic.ttf";
import NidoSans from "../assets/fonts/DMSans_400Regular.ttf";
import NidoSansMedium from "../assets/fonts/DMSans_500Medium.ttf";
import NidoSansSemibold from "../assets/fonts/DMSans_600SemiBold.ttf";
import NidoSansBold from "../assets/fonts/DMSans_700Bold.ttf";
import React, { useEffect, useRef } from "react";
import { useFonts } from "expo-font";
import { Stack, router, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, initialAuthLinkError, useApp } from "../src/state";
import {
  accountEntryDestination,
  cancelAccountEntry,
  consumeAccountEntry,
} from "../src/entry-navigation";
import { UnsavedNavigationGuard } from "../src/unsaved-changes";
function Navigation() {
  const { ready, email, userId, preferencesLoaded, passwordRecovery, state } =
    useApp();
  const pathname = usePathname();
  const handledUser = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!email || !userId) {
      handledUser.current = null;
      return;
    }
    if (handledUser.current === userId) return;
    if (passwordRecovery) {
      cancelAccountEntry();
      handledUser.current = userId;
      return;
    }
    if (!preferencesLoaded) return;
    const entry = consumeAccountEntry(email);
    if (initialAuthLinkError && !entry) {
      handledUser.current = userId;
      return;
    }
    const destination = accountEntryDestination({
      preferences: state.preferences,
      pathname,
      passwordRecovery,
      hasEntry: Boolean(entry),
    });
    handledUser.current = userId;
    if (destination) router.replace(destination);
  }, [
    ready,
    email,
    userId,
    preferencesLoaded,
    passwordRecovery,
    pathname,
    state.preferences,
  ]);
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
