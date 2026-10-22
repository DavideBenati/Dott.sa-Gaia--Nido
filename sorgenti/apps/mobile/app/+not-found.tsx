import React from "react";
import { router } from "expo-router";
import { Screen, Button } from "../src/ui";
export default function Missing() {
  return (
    <Screen
      title="Pagina non trovata"
      subtitle="Ritroviamo insieme il tuo percorso."
    >
      <Button onPress={() => router.replace("/")}>Torna al tuo Nido</Button>
    </Screen>
  );
}
