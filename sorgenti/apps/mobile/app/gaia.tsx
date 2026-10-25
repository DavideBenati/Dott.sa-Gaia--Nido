import React, { useEffect, useState } from "react";
import { View, Image, Pressable } from "react-native";
import { router } from "expo-router";
import { Text } from "../src/typography";
import { Screen, Notice, Button, ui } from "../src/ui";
import {
  defaultProfile,
  loadProfile,
  publicProfile,
} from "../src/professional";
import { useApp } from "../src/state";
import { colors } from "../src/theme";
import logo from "../assets/brand/maia-logo.png";
import { EmailContactButton } from "../src/email-contact";
const headings = new Set([
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
        .map((p, i) => (
          <Text
            key={i}
            accessibilityRole={headings.has(p) ? "header" : undefined}
            style={headings.has(p) ? ui.heading : [ui.body, { lineHeight: 27 }]}
          >
            {p}
          </Text>
        ))}
    </View>
  );
}
function More({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <View style={[ui.card, { gap: 16, padding: 20 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={[ui.label, { flex: 1, fontWeight: "700", fontSize: 19 }]}>
          {title}
        </Text>
        <Text style={ui.body}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open && <Paragraphs text={text} />}
    </View>
  );
}
export default function MetiMaia() {
  const { email } = useApp();
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
  const introduction = profile.bio.split(/\n\s*\n/).filter(Boolean);
  return (
    <Screen
      back
      eyebrow="IL PROGETTO"
      title="Crescere insieme."
      subtitle="Conoscenza, ascolto e piccoli passi per ogni famiglia."
    >
      <View
        style={{ maxWidth: 820, width: "100%", alignSelf: "center", gap: 22 }}
      >
        <View style={[ui.card, { backgroundColor: colors.sagePale, gap: 18 }]}>
          <Image
            source={logo}
            accessibilityLabel="Il fiore di loto di MetiMaia"
            resizeMode="contain"
            style={{ width: 120, height: 92, alignSelf: "center" }}
          />
          <Text accessibilityRole="header" style={ui.heading}>
            Benvenuti in MetiMaia
          </Text>
          <Paragraphs text={introduction.slice(0, 3).join("\n\n")} />
          <Button
            onPress={() => router.push(email ? "/welcome?edit=1" : "/account")}
          >
            {email ? "Scegli il tuo percorso" : "Crea il tuo account"}
          </Button>
          {email && (
            <Button variant="quiet" onPress={() => router.navigate("/(tabs)")}>
              Vai al mio percorso
            </Button>
          )}
        </View>
        <Text accessibilityRole="header" style={ui.heading}>
          Strumenti per la quotidianità
        </Text>
        <View style={{ gap: 12 }}>
          <Button
            variant="secondary"
            onPress={() => router.navigate("/discover")}
          >
            Esplora gli Argomenti
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.navigate("/checklists")}
          >
            Organizzati con le checklist
          </Button>
          {email && (
            <Button
              variant="quiet"
              onPress={() => router.push("/condivisioni")}
            >
              Condividi il percorso con chi ti è vicino
            </Button>
          )}
        </View>
        {profile.services.length > 0 && (
          <Text accessibilityRole="header" style={ui.heading}>
            Accanto a voi, in ogni fase
          </Text>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {profile.services.map((stage, i) => (
            <View
              key={i}
              style={[
                ui.card,
                { gap: 10, padding: 20, flexGrow: 1, flexBasis: 300 },
              ]}
            >
              <Text
                accessibilityRole="header"
                style={[ui.label, { fontWeight: "700", fontSize: 20 }]}
              >
                {stage.title}
              </Text>
              <Text style={ui.body}>{stage.description}</Text>
              {!!stage.details && <Text style={ui.body}>{stage.details}</Text>}
            </View>
          ))}
        </View>
        <Text accessibilityRole="header" style={ui.heading}>
          Conosci il progetto
        </Text>
        <Text style={ui.body}>
          Apri la sezione che ti interessa: il testo completo resta a tua
          disposizione.
        </Text>
        <More
          title="Perché è nato MetiMaia"
          text={introduction.slice(3).join("\n\n")}
        />
        <More
          title="Il nome e il fiore di loto"
          text={profile.qualifications}
        />
        <More title="La nostra filosofia" text={profile.service_area} />
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Parliamone insieme
          </Text>
          <Text style={ui.body}>
            Per informazioni e possibilità di accompagnamento, scrivi a Gaia.
            Modalità e disponibilità si concordano via email.
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
