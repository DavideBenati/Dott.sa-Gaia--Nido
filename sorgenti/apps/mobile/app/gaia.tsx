import React, { useEffect, useState } from "react";
import { View, Image } from "react-native";
import { router } from "expo-router";
import { Text } from "../src/typography";
import { Screen, Button, Notice, ui } from "../src/ui";
import {
  defaultProfile,
  loadProfile,
  publicProfile,
} from "../src/professional";
import logo from "../assets/brand/maia-logo.png";
import { EmailContactButton } from "../src/email-contact";

function Paragraphs({ text }: { text: string }) {
  return (
    <View style={{ gap: 16 }}>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <Text key={index} style={ui.body}>
            {paragraph}
          </Text>
        ))}
    </View>
  );
}
export default function Gaia() {
  const [profile, setProfile] = useState(() => publicProfile(defaultProfile));
  useEffect(() => {
    let active = true;
    void loadProfile().then((p) => {
      if (active) setProfile(publicProfile(p));
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Screen
      back
      eyebrow="CONOSCI LA TUA OSTETRICA"
      title="Dott.sa Gaia"
      subtitle="La tua ostetrica di fiducia a Roma."
    >
      <View
        style={{ maxWidth: 820, width: "100%", alignSelf: "center", gap: 24 }}
      >
        <View style={[ui.card, { gap: 18 }]}>
          <Image
            source={profile.portrait_url ? { uri: profile.portrait_url } : logo}
            accessibilityLabel={
              profile.portrait_url ? "Dott.sa Gaia" : "Il logo di metiMaia"
            }
            resizeMode="contain"
            style={{
              width: "100%",
              height: profile.portrait_url ? 240 : 150,
              borderRadius: 20,
            }}
          />
          <Text style={ui.heading}>Ostetrica | metiMaia</Text>
          <Paragraphs text={profile.bio} />
        </View>
        <Button onPress={() => router.push("/contatti")}>
          Contatta Gaia via email
        </Button>
        {profile.qualifications !== "" && (
          <View style={[ui.card, { gap: 18 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              Il mio percorso e la formazione
            </Text>
            <Paragraphs text={profile.qualifications} />
          </View>
        )}
        <Text accessibilityRole="header" style={ui.heading}>
          Servizi e modalità d’incontro
        </Text>
        <Text style={ui.body}>{profile.service_area}</Text>
        <Text style={ui.body}>
          Le richieste da questo sito riguardano le consulenze private. Per gli
          appuntamenti ospedalieri fai riferimento ai canali della struttura.
        </Text>
        {profile.services.length ? (
          profile.services.map((service, index) => (
            <View key={index} style={[ui.card, { gap: 14 }]}>
              <Text style={ui.heading}>{service.title}</Text>
              <Text style={ui.body}>{service.description}</Text>
              {service.details !== "" && (
                <Text style={ui.body}>{service.details}</Text>
              )}
              <EmailContactButton
                email={profile.contact_email}
                subject={`metiMaia — ${service.title}`}
              >
                Chiedi informazioni via email
              </EmailContactButton>
            </View>
          ))
        ) : (
          <Notice>
            Servizi, zone, modalità e costi sono da concordare direttamente con
            Gaia. Puoi chiedere informazioni senza creare un account e senza
            inserire dati sanitari.
          </Notice>
        )}
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Cosa succede dopo la richiesta?
          </Text>
          <Text style={ui.body}>
            1. Scrivi un’email con le tue domande e preferenze, senza referti o
            dati sanitari.
          </Text>
          <Text style={ui.body}>
            2. Gaia valuta la disponibilità e risponde via email per concordare
            modalità, luogo ed eventuali costi.
          </Text>
          <Text style={ui.body}>
            3. L’incontro è confermato soltanto dopo un accordo diretto. I tempi
            di risposta non sono ancora definiti.
          </Text>
        </View>
        <EmailContactButton email={profile.contact_email} />
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
