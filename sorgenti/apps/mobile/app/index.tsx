import React from "react";
import { Redirect } from "expo-router";
import { useApp } from "../src/state";
export default function Index() {
  const { state } = useApp();
  return (
    <Redirect href={state.preferences.onboarded ? "/(tabs)" : "/welcome"} />
  );
}
