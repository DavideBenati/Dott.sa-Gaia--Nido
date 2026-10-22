import React from "react";
import { Text, View } from "react-native";
import { disclaimer } from "@nido/core";
import { Screen, Notice, ui } from "../src/ui";
export default function Privacy() {
  return (
    <Screen
      back
      title="Privacy, con parole semplici."
      subtitle="Condividere meno è una scelta possibile."
    >
      <Notice icon="lock">
        Informazioni sul prototipo: informativa e base giuridica richiedono una
        revisione indipendente prima del lancio pubblico.
      </Notice>
      <View style={{ gap: 22, marginVertical: 24 }}>
        {[
          [
            "Le date sono facoltative",
            "Puoi leggere come ospite e scegliere un percorso senza condividere date o dati altrui. La data richiede il tuo consenso alla personalizzazione.",
          ],
          [
            "Dove restano i tuoi dati",
            "In demo, preferenze, salvati e progressi rimangono sul dispositivo, senza cifratura locale dedicata. Con un account configurato vengono conservati su Supabase e protetti da regole di accesso per proprietario.",
          ],
          [
            "Le tue scelte",
            "Dal profilo puoi revocare la personalizzazione, rimuovere la data, esportare o cancellare i dati. Il consenso marketing è separato e inizialmente disattivato.",
          ],
          [
            "Nessun tracker pubblicitario",
            "Non raccogliamo sintomi, diagnosi o dati personali negli eventi analitici. Le fonti esterne si aprono soltanto su tua richiesta.",
          ],
          [
            "Prima della produzione",
            "Titolare, contatti reali, base giuridica, conservazione e diritti devono essere definiti e verificati. Non dichiariamo conformità legale certificata.",
          ],
        ].map(([heading, body]) => (
          <View key={heading} style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={ui.heading}>
              {heading}
            </Text>
            <Text style={ui.body}>{body}</Text>
          </View>
        ))}
      </View>
      <Notice>{disclaimer}</Notice>
    </Screen>
  );
}
