import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useApp } from "../src/state";
import { hasCompletedProfileType } from "@nido/core";
import { usePwa } from "../src/pwa";
import {
  accountReturnTarget,
  videoCallReturnPath,
} from "../src/entry-navigation";
export default function Index() {
  const { email, passwordRecovery, preferencesLoaded, state } = useApp();
  const { standalone } = usePwa();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const target = accountReturnTarget(returnTo);
  const videoPath = videoCallReturnPath(target);
  if (passwordRecovery) return <Redirect href="/account" />;
  if (email && !preferencesLoaded) return <Redirect href="/account" />;
  if (email && !hasCompletedProfileType(state.preferences))
    return <Redirect href={`/welcome?onboarding=1&returnTo=${target}`} />;
  if (email && returnTo === "documents")
    return <Redirect href="/miei-documenti" />;
  if (email && videoPath) return <Redirect href={videoPath} />;
  return (
    <Redirect href={email ? (standalone ? "/(tabs)" : "/gaia") : "/welcome"} />
  );
}
