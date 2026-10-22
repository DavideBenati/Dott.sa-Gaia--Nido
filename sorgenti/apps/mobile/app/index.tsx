import React from "react";
import { Redirect } from "expo-router";
import { useApp } from "../src/state";
export default function Index() {
  const { state, passwordRecovery } = useApp();
  if (passwordRecovery) return <Redirect href="/account" />;
  return (
    <Redirect href={state.preferences.onboarded ? "/(tabs)" : "/welcome"} />
  );
}
