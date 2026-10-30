import React from "react";
import { Redirect } from "expo-router";
import { useApp } from "../src/state";
import { hasCompletedProfileType } from "@nido/core";
export default function Index() {
  const { email, passwordRecovery, preferencesLoaded, state } = useApp();
  if (passwordRecovery) return <Redirect href="/account" />;
  if (email && !preferencesLoaded) return <Redirect href="/account" />;
  if (email && !hasCompletedProfileType(state.preferences))
    return <Redirect href="/welcome?onboarding=1&returnTo=project" />;
  return <Redirect href={email ? "/gaia" : "/welcome"} />;
}
