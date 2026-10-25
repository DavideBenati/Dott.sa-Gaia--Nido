import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
import { defaultProfile, loadProfile } from "../src/professional";
import { EmailContactButton } from "../src/email-contact";
export default function Contacts() {
  const [profile, setProfile] = useState(defaultProfile);
  useEffect(() => {
    let active = true;
    void loadProfile().then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Screen
      back
      title="Come contattare Gaia"
      subtitle="Scrivi via email per informazioni e disponibilità."
    >
      <View
        style={{ maxWidth: 800, width: "100%", alignSelf: "center", gap: 20 }}
      >
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Email di contatto
          </Text>
          <Text style={ui.body}>
            Per informazioni sui servizi o per richiedere un incontro, scrivi a
            Gaia via email. Luogo, modalità, disponibilità ed eventuali costi
            saranno concordati direttamente. Non inviare referti o informazioni
            sanitarie.
          </Text>
          <Text selectable style={ui.body}>
            {profile.contact_email}
          </Text>
          <EmailContactButton email={profile.contact_email} />
        </View>
        <Notice>
          Le risposte non sono immediate; giorni, orari e tempi non sono ancora
          definiti. Non usare l’email per urgenze: chiama il 112 o rivolgiti ai
          servizi sanitari.
        </Notice>
        <Button variant="quiet" onPress={() => router.push("/gaia")}>
          Scopri il progetto MetiMaia
        </Button>
      </View>
    </Screen>
  );
}
