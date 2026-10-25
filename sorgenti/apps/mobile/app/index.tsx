import React from "react";
import { Redirect } from "expo-router";
import { useApp } from "../src/state";
export default function Index() {
  const { email, passwordRecovery } = useApp();
  if (passwordRecovery) return <Redirect href="/account" />;
  return <Redirect href={email ? "/gaia" : "/welcome"} />;
}
