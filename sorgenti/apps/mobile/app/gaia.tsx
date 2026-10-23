import React, { useEffect, useState } from "react";
import { View, Image, Linking } from "react-native";
import { router } from "expo-router";
import { Text } from "../src/typography";
import { Screen, Button, Notice, ui } from "../src/ui";
import { defaultProfile, loadProfile } from "../src/professional";
import logo from "../assets/brand/maia-logo.png";
export default function Gaia() {
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
      eyebrow="CONOSCI LA TUA OSTETRICA"
      title="Gaia Brunetti"
      subtitle="Con te, dall’attesa alla nascita."
    >
      <View
        style={{ maxWidth: 820, width: "100%", alignSelf: "center", gap: 24 }}
      >
        <View style={[ui.card, { gap: 18 }]}>
          <Image
            source={profile.portrait_url ? { uri: profile.portrait_url } : logo}
            accessibilityLabel={
              profile.portrait_url ? "Gaia Brunetti" : "Il logo di metiMaia"
            }
            resizeMode="contain"
            style={{ width: "100%", height: 240, borderRadius: 20 }}
          />
          <Text style={ui.heading}>Ostetrica | metiMaia</Text>
          <Text style={ui.body}>{profile.bio}</Text>
          {profile.qualifications !== "" && (
            <>
              <Text style={ui.label}>Formazione e qualifiche</Text>
              <Text style={ui.body}>{profile.qualifications}</Text>
            </>
          )}
        </View>
        <Text style={ui.heading}>Come possiamo incontrarci</Text>
        <Text style={ui.body}>{profile.service_area}</Text>
        {profile.services.length ? (
          profile.services.map((service, index) => (
            <View key={index} style={[ui.card, { gap: 14 }]}>
              <Text style={ui.heading}>{service.title}</Text>
              <Text style={ui.body}>{service.description}</Text>
              {service.details !== "" && (
                <Text style={ui.body}>{service.details}</Text>
              )}
              <Button onPress={() => router.push("/prenota")}>
                Chiedi informazioni e disponibilità
              </Button>
            </View>
          ))
        ) : (
          <Notice>
            Per conoscere i servizi effettivamente disponibili, le modalità e
            gli eventuali costi, contatta Gaia. Le schede dei servizi verranno
            pubblicate dopo la loro definizione.
          </Notice>
        )}
        <Button onPress={() => router.push("/prenota")}>
          Richiedi un incontro
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            void Linking.openURL(`mailto:${profile.contact_email}`).catch(
              () => {},
            );
          }}
        >
          Scrivi a Gaia via email
        </Button>
        <Text selectable style={ui.body}>
          {profile.contact_email}
        </Text>
        <Notice>
          Questo sito offre informazioni e strumenti educativi. Non è un
          servizio di emergenza né sostituisce una valutazione sanitaria
          individuale.
        </Notice>
      </View>
    </Screen>
  );
}
