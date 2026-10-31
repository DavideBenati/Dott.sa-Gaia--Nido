import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useApp } from "../src/state";
import { hasCompletedProfileType } from "@nido/core";
import { usePwa } from "../src/pwa";
export default function Index() {
  const { email, passwordRecovery, preferencesLoaded, state } = useApp();
  const { standalone } = usePwa();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  if (passwordRecovery) return <Redirect href="/account" />;
  if (email && !preferencesLoaded) return <Redirect href="/account" />;
  if (email && !hasCompletedProfileType(state.preferences))
    return (
      <Redirect
        href={
          returnTo === "documents"
            ? "/welcome?onboarding=1&returnTo=documents"
            : "/welcome?onboarding=1&returnTo=project"
        }
      />
    );
  if (email && returnTo === "documents")
    return <Redirect href="/miei-documenti" />;
  return (
    <Redirect href={email ? (standalone ? "/(tabs)" : "/gaia") : "/welcome"} />
  );
}
