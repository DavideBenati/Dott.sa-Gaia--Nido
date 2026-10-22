import React from "react";
import { Text, View } from "react-native";
import { disclaimer } from "@nido/core";
import { Screen, Notice, ui } from "../src/ui";
export default function Help() {
  return (
    <Screen back eyebrow="UNO SPAZIO DI ASCOLTO" title="Quando chiedere aiuto">
      <Notice warm icon="help">
        Se hai una preoccupazione urgente per la tua salute o quella del
        bambino, contatta subito i servizi sanitari appropriati o il servizio di
        emergenza del paese in cui ti trovi. Nido non valuta sintomi, non
        gestisce emergenze e non può confermare che una situazione sia sicura.
      </Notice>
      <View style={{ gap: 20, marginVertical: 25 }}>
        <Text style={ui.heading}>Una domanda merita spazio.</Text>
        <Text style={ui.body}>
          Per dubbi sulla gravidanza, sul recupero, sull’alimentazione o sul
          benessere emotivo, rivolgiti all’ostetrica o al professionista che ti
          segue. Chiedere sostegno non richiede di aspettare che una difficoltà
          diventi grande.
        </Text>
        <Text style={ui.body}>
          Concorda con il tuo servizio i contatti e le modalità di accesso. Per
          esigenze urgenti, non attendere una risposta dall’app.
        </Text>
      </View>
      <Notice>{disclaimer}</Notice>
    </Screen>
  );
}
