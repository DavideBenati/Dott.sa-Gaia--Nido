import React, { useEffect, useState } from "react";
import { View, Linking } from "react-native";
import { router } from "expo-router";
import { loadEditorialContent } from "@nido/data";
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { loadProfile, defaultProfile } from "../src/professional";
import { loadShop } from "../src/shop";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
type Check = {
  title: string;
  items: string[];
  href: "/impostazioni" | "/studio" | "/shop";
};
export default function Checks() {
  const { email } = useApp();
  return (
    <Screen
      back
      title="Verifiche del sito"
      subtitle="Un promemoria operativo: campi compilati non equivalgono a contenuti verificati."
    >
      {email ? (
        <ChecksContent key={email} />
      ) : (
        <Button onPress={() => router.push("/account?mode=login")}>
          Accedi
        </Button>
      )}
    </Screen>
  );
}
function ChecksContent() {
  const { allowed, checking } = useEditorAccess();
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!allowed || !client) return;
    void (async () => {
      const results = await Promise.allSettled([
        loadProfile(),
        loadEditorialContent(client!),
        loadShop(true),
      ]);
      if (!active) return;
      const items: Check[] = [];
      const [p, c, s] = results;
      if (p.status === "fulfilled") {
        const v = p.value;
        items.push({
          title: "Gaia e servizi",
          href: "/impostazioni",
          items: [
            !v.portrait_url && "Foto professionale non inserita (facoltativa).",
            !v.qualifications &&
              "Qualifiche e iscrizione non compilate: richiedono verifica reale.",
            !v.services.length &&
              "Servizi non definiti: il sito invita a chiedere informazioni.",
            v.service_area === defaultProfile.service_area &&
              "Zone e modalità ancora da concordare.",
            !v.privacy_retention &&
              "Tempi e criteri di conservazione da definire.",
            !v.privacy_transfers && "Trasferimenti e garanzie da verificare.",
          ].filter(Boolean) as string[],
        });
      }
      if (c.status === "fulfilled") {
        const v = c.value;
        items.push({
          title: "Contenuti editoriali",
          href: "/studio",
          items: [
            `${v.articles.filter((a) => a.status === "published" && a.approved && !a.isDemo).length} articoli pubblicati e approvati.`,
            `${v.articles.filter((a) => a.status !== "published" && !a.isDemo).length} articoli in bozza, revisione o archivio.`,
            `${v.articles.filter((a) => a.isDemo).length} articoli dimostrativi: non presentarli come consigli clinici validati.`,
            "Verifica autore, fonti, data di revisione e comprensibilità prima di pubblicare.",
          ],
        });
      }
      if (s.status === "fulfilled") {
        const v = s.value;
        items.push({
          title: "Prodotti e acquisti",
          href: "/shop",
          items: [
            v.settings.enabled
              ? "Vendita diretta attiva: controlla che condizioni e prezzi siano aggiornati."
              : "Vendita diretta disattivata.",
            v.settings.recommendations_enabled
              ? "Selezione Amazon attiva."
              : "Selezione Amazon disattivata.",
            `${v.products.filter((p) => p.status === "published").length} schede prodotto pubblicate.`,
            "Per i prodotti reali verifica caratteristiche, uso, eventuali ingredienti/avvertenze, immagini autorizzate e corrispondenza con Stripe.",
            "La prova completa del pagamento e del rimborso va eseguita nell’ambiente di test del tuo account Stripe, non con un acquisto reale involontario.",
          ],
        });
      }
      setChecks(items);
      setError(
        results.some((r) => r.status === "rejected")
          ? "Alcune verifiche non sono disponibili: controlla connessione, permessi e configurazione. Non sono considerate superate."
          : "",
      );
    })();
    return () => {
      active = false;
    };
  }, [allowed, version]);
  return (
    <View
      style={{ maxWidth: 800, width: "100%", alignSelf: "center", gap: 20 }}
    >
      {checking ? (
        <Notice>Verifica permessi…</Notice>
      ) : !allowed ? (
        <Notice>Accesso riservato. Verifica ruolo e secondo fattore.</Notice>
      ) : (
        <>
          <Notice>
            Questa pagina riepiloga i dati disponibili. Non certifica
            qualifiche, correttezza clinica, adempimenti legali, pagamenti o
            backup.
          </Notice>
          <Button variant="quiet" onPress={() => setVersion((v) => v + 1)}>
            Aggiorna verifiche
          </Button>
          {checks.map((check) => (
            <View style={[ui.card, { gap: 12 }]} key={check.title}>
              <Text accessibilityRole="header" style={ui.heading}>
                {check.title}
              </Text>
              {check.items.length ? (
                check.items.map((item, i) => (
                  <Text key={i} style={ui.body}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={ui.body}>
                  Campi principali compilati. Confermane comunque l’esattezza
                  prima di promuovere il sito.
                </Text>
              )}
              <Button
                variant="secondary"
                onPress={() => router.push(check.href)}
              >
                {`Apri ${check.title.toLowerCase()}`}
              </Button>
            </View>
          ))}
          <View style={[ui.card, { gap: 12 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              Newsletter, backup e prove finali
            </Text>
            <Text style={ui.body}>
              Controlla iscrizioni e revoche prima di ogni campagna. Conserva
              una copia completa del database e dei file e verifica il
              ripristino in un progetto separato. Il JSON di Studio contiene
              soltanto i contenuti editoriali.
            </Text>
            <Button
              variant="secondary"
              onPress={() => router.push("/newsletter-admin")}
            >
              Controlla newsletter e revoche
            </Button>
            <Button
              variant="quiet"
              onPress={() =>
                void Linking.openURL(
                  "https://metimaia.com/GESTIONE-E-BACKUP.txt",
                ).catch(() =>
                  setError(
                    "Guida non disponibile: verifica il caricamento completo del pacchetto v5.",
                  ),
                )
              }
            >
              Apri guida a backup e prove finali
            </Button>
          </View>
        </>
      )}
      {error !== "" && (
        <View accessibilityRole="alert">
          <Notice>{error}</Notice>
        </View>
      )}
    </View>
  );
}
