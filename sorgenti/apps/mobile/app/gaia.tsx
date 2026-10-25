import React, { useEffect, useState } from "react";
import { View, Image } from "react-native";
import { Text } from "../src/typography";
import { Screen, Notice, ui } from "../src/ui";
import {
  defaultProfile,
  loadProfile,
  publicProfile,
} from "../src/professional";
import logo from "../assets/brand/maia-logo.png";
import { EmailContactButton } from "../src/email-contact";

const sectionTitles = new Set([
  "Benvenuti in MetiMaia",
  "Il significato di MetiMaia",
  "Il fiore di loto: il simbolo di MetiMaia",
  "La nostra filosofia",
  "Insieme, nel viaggio della genitorialità",
]);
function Paragraphs({ text }: { text: string }) {
  return (
    <View style={{ gap: 16 }}>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <Text
            key={index}
            accessibilityRole={
              sectionTitles.has(paragraph) ? "header" : undefined
            }
            style={sectionTitles.has(paragraph) ? ui.heading : ui.body}
          >
            {paragraph}
          </Text>
        ))}
    </View>
  );
}
export default function MetiMaia() {
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
      eyebrow="IL PROGETTO"
      title="MetiMaia"
      subtitle="Crescere insieme, un passo alla volta."
    >
      <View
        style={{ maxWidth: 820, width: "100%", alignSelf: "center", gap: 24 }}
      >
        <View style={[ui.card, { gap: 18 }]}>
          <Image
            source={logo}
            accessibilityLabel="Il fiore di loto di MetiMaia"
            resizeMode="contain"
            style={{ width: "100%", height: 150 }}
          />
          <Paragraphs text={profile.bio} />
        </View>
        {profile.qualifications !== "" && (
          <View style={[ui.card, { gap: 18 }]}>
            <Paragraphs text={profile.qualifications} />
          </View>
        )}
        {profile.services.length > 0 && (
          <>
            <Text accessibilityRole="header" style={ui.heading}>
              Accanto a voi, in ogni fase
            </Text>
            {profile.services.map((stage, index) => (
              <View key={index} style={[ui.card, { gap: 14 }]}>
                <Text accessibilityRole="header" style={ui.heading}>
                  {stage.title}
                </Text>
                <Text style={ui.body}>{stage.description}</Text>
                {stage.details !== "" && (
                  <Text style={ui.body}>{stage.details}</Text>
                )}
              </View>
            ))}
          </>
        )}
        {profile.service_area !== "" && (
          <View style={[ui.card, { gap: 18 }]}>
            <Paragraphs text={profile.service_area} />
          </View>
        )}
        <View style={[ui.card, { gap: 14 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Parliamone insieme
          </Text>
          <Text style={ui.body}>
            Per conoscere le possibilità di accompagnamento, scrivi a Gaia.
            Modalità, disponibilità ed eventuali costi vengono concordati
            direttamente via email.
          </Text>
          <EmailContactButton email={profile.contact_email}>
            Scrivi a Gaia via email
          </EmailContactButton>
          <Text selectable style={ui.body}>
            {profile.contact_email}
          </Text>
        </View>
        <Notice>
          MetiMaia offre informazioni e strumenti educativi. Non è un servizio
          di emergenza e non sostituisce la relazione con i professionisti
          sanitari.
        </Notice>
      </View>
    </Screen>
  );
}
