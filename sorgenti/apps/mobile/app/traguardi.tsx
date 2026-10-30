import React from "react";
import { View } from "react-native";
import { Screen } from "../src/ui";
import { MemberAchievements } from "../src/member-achievements";

export default function Achievements() {
  return (
    <Screen
      back
      eyebrow="I MIEI TRAGUARDI"
      title="Un piccolo passo da celebrare."
      subtitle="Il tuo account, le letture, la prima selezione e le checklist completate."
    >
      <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
        <MemberAchievements />
      </View>
    </Screen>
  );
}
