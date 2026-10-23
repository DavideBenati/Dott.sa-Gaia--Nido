import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  Linking,
  Pressable,
  Modal,
  useWindowDimensions,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { router } from "expo-router";
import logo from "../../assets/brand/maia-logo.png";
import { Text, TextInput } from "../../src/typography";
import { Screen, Notice, Button, ui } from "../../src/ui";
import { colors } from "../../src/theme";
import { useApp } from "../../src/state";
import { useEditorAccess } from "../../src/editor-access";
import {
  emptyShopSettings,
  formatPrice,
  loadShop,
  parsePrice,
  saveShopProduct,
  saveShopSettings,
  validCheckout,
  validAmazonLink,
  type ShopProduct,
  type ShopSettings,
} from "../../src/shop";
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[
          ui.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
function CollectionIdea({
  kind,
  title,
  text,
}: {
  kind: "bag" | "cup" | "book";
  title: string;
  text: string;
}) {
  return (
    <View style={[ui.card, { flex: 1, minWidth: 230, gap: 15 }]}>
      <View
        style={{
          height: 220,
          backgroundColor: kind === "cup" ? colors.peach : colors.sagePale,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={180}
          height={180}
          viewBox="0 0 180 180"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {kind === "bag" ? (
            <>
              <Path
                d="M57 60V45C57 8 123 8 123 45V60"
                stroke="#8C7868"
                strokeWidth={6}
                fill="none"
              />
              <Path
                d="M38 55H142L150 160H30Z"
                fill="#FAF7F2"
                stroke="#C7BEAD"
                strokeWidth={2}
              />
            </>
          ) : kind === "cup" ? (
            <>
              <Rect
                x={57}
                y={52}
                width={68}
                height={110}
                rx={14}
                fill="#FAF7F2"
                stroke="#C7BEAD"
                strokeWidth={2}
              />
              <Rect
                x={69}
                y={26}
                width={44}
                height={31}
                rx={6}
                fill="#8C7868"
              />
              <Path d="M84 15H117V29H84Z" fill="#8C7868" />
            </>
          ) : (
            <>
              <Rect
                x={39}
                y={20}
                width={105}
                height={145}
                rx={7}
                fill="#FAF7F2"
                stroke="#C7BEAD"
                strokeWidth={2}
              />
              <Path d="M49 20V165" stroke="#B9C5B4" strokeWidth={4} />
            </>
          )}
        </Svg>
        <Image
          source={logo}
          accessibilityLabel="Logo metiMaia su esempio illustrativo"
          resizeMode="contain"
          style={{
            position: "absolute",
            width: kind === "bag" ? 74 : 65,
            height: 70,
            top: 90,
            left: "50%",
            marginLeft: kind === "bag" ? -37 : -32,
          }}
        />
      </View>
      <Text style={ui.heading}>{title}</Text>
      <Text style={ui.body}>{text}</Text>
      <Text style={ui.label}>ESEMPIO DI STILE · NON IN VENDITA</Text>
    </View>
  );
}
export default function Shop() {
  const { email } = useApp();
  const { allowed } = useEditorAccess();
  return (
    <Screen
      eyebrow="IL MONDO METIMAIA"
      title="Lo Shop di metiMaia"
      subtitle="La selezione Amazon e i prodotti della Dott.ssa Gaia Brunetti."
    >
      <ShopContent key={email ?? "guest"} editor={allowed} />
    </Screen>
  );
}
function ShopContent({ editor }: { editor: boolean }) {
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState<ShopSettings>(emptyShopSettings);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [section, setSection] = useState<"amazon" | "doctor">("amazon");
  const [manage, setManage] = useState(false);
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [checkout, setCheckout] = useState<ShopProduct | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadShop(editor)
      .then((data) => {
        if (active) {
          setSettings(data.settings);
          setProducts(data.products);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editor]);
  async function reload() {
    const data = await loadShop(editor);
    setProducts(data.products);
    setSettings(data.settings);
  }
  async function saveProduct(status: ShopProduct["status"]) {
    if (!product || busy) return;
    const cents = product.kind === "doctor" ? parsePrice(price) : 0;
    if (product.kind === "doctor" && price.trim() && cents === null) {
      setMessage(
        "Inserisci un prezzo positivo in euro, con massimo due decimali (esempio: 19,90).",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const updated = { ...product, price_cents: cents ?? 0, status };
      await saveShopProduct(updated);
      await reload();
      setProduct(null);
      setMessage(
        status === "draft"
          ? "Prodotto salvato in bozza. Non è visibile ai clienti."
          : product.kind === "amazon"
            ? "Scheda Amazon pubblicata. Sarà visibile quando la selezione Amazon sarà attiva."
            : "Prodotto pubblicato. Sarà visibile quando la vendita diretta sarà attiva.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings() {
    setBusy(true);
    setMessage("");
    try {
      await saveShopSettings(settings);
      await reload();
      setMessage(
        settings.enabled
          ? "Negozio attivato. Verifica ogni acquisto con la modalità di test del fornitore prima del lancio."
          : settings.recommendations_enabled
            ? "Impostazioni salvate. Selezione Amazon attiva; vendita diretta disattivata."
            : "Impostazioni salvate. Vendita diretta e selezione Amazon disattivate.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openCheckout() {
    if (
      !checkout ||
      checkout.kind !== "doctor" ||
      !settings.enabled ||
      !validCheckout(checkout.checkout_url)
    )
      return;
    try {
      await Linking.openURL(checkout.checkout_url);
      setCheckout(null);
    } catch {
      setMessage(
        "Non è stato possibile aprire il pagamento. Riprova più tardi.",
      );
    }
  }
  return (
    <View
      style={{ gap: 24, width: "100%", maxWidth: 1100, alignSelf: "center" }}
    >
      {editor && (
        <Button
          variant="secondary"
          onPress={() => {
            setManage(!manage);
            setProduct(null);
            setMessage("");
          }}
        >
          {manage ? "Vedi lo shop" : "Gestisci prodotti e vendite"}
        </Button>
      )}
      {message !== "" && !manage && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>{message}</Notice>
        </View>
      )}
      {loading ? (
        <Notice>Caricamento dello shop…</Notice>
      ) : manage && editor ? (
        <>
          {loadError && (
            <Notice>
              Prima di salvare, applica la configurazione shop su Supabase
              inclusa nel pacchetto. Non modificare le altre tabelle.
            </Notice>
          )}
          {product ? (
            <View
              style={[ui.card, { gap: 18 }]}
              pointerEvents={busy ? "none" : "auto"}
            >
              <Text style={ui.heading}>Scheda prodotto</Text>
              <Text style={ui.label}>Tipo di scheda</Text>
              <Button
                variant={product.kind === "amazon" ? "secondary" : "quiet"}
                onPress={() =>
                  setProduct({
                    ...product,
                    kind: "amazon",
                    checkout_url: "",
                    price_cents: 0,
                  })
                }
              >
                Selezionato su Amazon
              </Button>
              <Button
                variant={product.kind === "doctor" ? "secondary" : "quiet"}
                onPress={() =>
                  setProduct({ ...product, kind: "doctor", checkout_url: "" })
                }
              >
                Prodotto della dottoressa
              </Button>
              <Field
                label="Nome prodotto"
                value={product.title}
                onChange={(title) => setProduct({ ...product, title })}
              />
              <Field
                label="Descrizione prodotto"
                value={product.description}
                onChange={(description) =>
                  setProduct({ ...product, description })
                }
                multiline
              />
              {product.kind === "doctor" && (
                <Field
                  label="Prezzo in euro"
                  value={price}
                  onChange={setPrice}
                />
              )}
              <Field
                label="Immagine prodotto (HTTPS)"
                value={product.image_url}
                onChange={(image_url) => setProduct({ ...product, image_url })}
              />
              <Field
                label={
                  product.kind === "amazon"
                    ? "Link Amazon"
                    : "Stripe Payment Link"
                }
                value={product.checkout_url}
                onChange={(checkout_url) =>
                  setProduct({ ...product, checkout_url })
                }
              />
              <Notice>
                {product.kind === "amazon"
                  ? "Inserisci il link originale al prodotto, o il tuo link affiliato autorizzato. Prezzi, disponibilità e acquisti restano su Amazon. Non copiare immagini Amazon senza i relativi diritti: puoi lasciare l’immagine vuota. Nessuna commissione è attivata automaticamente dal sito."
                  : "Crea il prodotto in Stripe e copia un Payment Link https://buy.stripe.com/. Configura lì varianti, quantità, indirizzo di spedizione, IVA e consegna. Prezzo e immagine qui devono corrispondere a quelli del pagamento. Non inserire chiavi API."}
              </Notice>
              {message !== "" && (
                <View accessibilityRole="alert">
                  <Notice>{message}</Notice>
                </View>
              )}
              <Button disabled={busy} onPress={() => void saveProduct("draft")}>
                Salva prodotto in bozza
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onPress={() => void saveProduct("published")}
              >
                Pubblica prodotto
              </Button>
              <Button
                disabled={busy}
                variant="quiet"
                onPress={() => {
                  setProduct(null);
                  setMessage("");
                }}
              >
                Annulla modifica prodotto
              </Button>
            </View>
          ) : (
            <>
              {message !== "" && <Notice>{message}</Notice>}
              <Button
                onPress={() => {
                  setPrice("");
                  setMessage("");
                  setProduct({
                    id: crypto.randomUUID(),
                    kind: "doctor",
                    title: "",
                    description: "",
                    price_cents: 0,
                    image_url: "",
                    checkout_url: "",
                    status: "draft",
                  });
                }}
              >
                Nuovo prodotto
              </Button>
              {products.map((item) => (
                <View key={item.id} style={[ui.card, { gap: 10 }]}>
                  <Text style={ui.heading}>{item.title}</Text>
                  <Text style={ui.body}>
                    {item.status === "draft" ? "Bozza" : "Pubblicato"} ·{" "}
                    {item.price_cents > 0
                      ? formatPrice(item.price_cents)
                      : item.kind === "amazon"
                        ? "Prezzo su Amazon"
                        : "Prezzo da definire"}
                  </Text>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setProduct({ ...item });
                      setPrice(
                        item.price_cents
                          ? (item.price_cents / 100).toFixed(2)
                          : "",
                      );
                    }}
                  >{`Modifica ${item.title}`}</Button>
                </View>
              ))}
              <View
                style={[ui.card, { gap: 18 }]}
                pointerEvents={busy ? "none" : "auto"}
              >
                <Text style={ui.heading}>Selezione Amazon</Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Mostra selezione Amazon"
                  accessibilityState={{
                    checked: settings.recommendations_enabled,
                  }}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      recommendations_enabled:
                        !settings.recommendations_enabled,
                    })
                  }
                >
                  <Text style={ui.body}>
                    {settings.recommendations_enabled ? "☑" : "☐"} Mostra i
                    prodotti Amazon pubblicati.
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Link affiliati Amazon"
                  accessibilityState={{ checked: settings.amazon_affiliate }}
                  onPress={() =>
                    setSettings({
                      ...settings,
                      amazon_affiliate: !settings.amazon_affiliate,
                    })
                  }
                >
                  <Text style={ui.body}>
                    {settings.amazon_affiliate ? "☑" : "☐"} Uso link affiliati e
                    ho un account Amazon Affiliati abilitato. Mostra la
                    dichiarazione delle commissioni.
                  </Text>
                </Pressable>
                <Text style={ui.heading}>
                  Vendita diretta: venditore, spedizioni e resi
                </Text>
                <Notice>
                  Per avviare la vendita servono dati reali, condizioni di
                  vendita e un account di pagamento attivo. L’inserimento dei
                  campi non sostituisce la verifica degli obblighi fiscali e di
                  vendita.
                </Notice>
                {(
                  [
                    ["seller_name", "Nome o ragione sociale del venditore"],
                    ["seller_address", "Indirizzo del venditore"],
                    ["seller_contact", "Email assistenza acquisti"],
                    ["tax_details", "Dati fiscali del venditore"],
                    ["shipping_terms", "Spedizioni: paesi, costi e tempi"],
                    ["returns_terms", "Resi e diritto di recesso"],
                    ["terms_url", "Link HTTPS alle condizioni di vendita"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={settings[key]}
                    onChange={(value) =>
                      setSettings({ ...settings, [key]: value })
                    }
                    multiline={
                      key === "shipping_terms" || key === "returns_terms"
                    }
                  />
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Attiva vendite shop"
                  accessibilityState={{ checked: settings.enabled }}
                  onPress={() =>
                    setSettings({ ...settings, enabled: !settings.enabled })
                  }
                >
                  <Text style={ui.body}>
                    {settings.enabled ? "☑" : "☐"} Attiva gli acquisti dopo aver
                    verificato prodotti, prezzi, condizioni e configurazione
                    Stripe.
                  </Text>
                </Pressable>
                {message !== "" && (
                  <View accessibilityRole="alert">
                    <Notice>{message}</Notice>
                  </View>
                )}
                <Button disabled={busy} onPress={() => void saveSettings()}>
                  Salva impostazioni shop
                </Button>
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <Button
              variant={section === "amazon" ? "secondary" : "quiet"}
              onPress={() => setSection("amazon")}
            >
              Selezionati su Amazon
            </Button>
            <Button
              variant={section === "doctor" ? "secondary" : "quiet"}
              onPress={() => setSection("doctor")}
            >
              I prodotti della dottoressa
            </Button>
          </View>
          {loadError && (
            <Notice>
              Il catalogo non è ancora disponibile. Le schede qui sotto sono
              solo un’anteprima di stile.
            </Notice>
          )}
          {section === "amazon" ? (
            <Notice>
              {settings.amazon_affiliate
                ? "In qualità di Affiliato Amazon ricevo un guadagno dagli acquisti idonei. Gli acquisti si effettuano su Amazon, dove sono indicati prezzo aggiornato, venditore, disponibilità, spedizione e resi."
                : "Una selezione della Dott.ssa Gaia Brunetti. I collegamenti aprono Amazon: controlla lì prezzo aggiornato, venditore, disponibilità, spedizione e resi."}
            </Notice>
          ) : (
            <Notice>
              Oli e oggetti per i più piccoli: le schede dei prodotti
              disponibili indicheranno caratteristiche, modalità d’uso, prezzo e
              venditore. Nessun prodotto è presentato come sostituto di una
              valutazione professionale.
            </Notice>
          )}
          {products.filter(
            (item) =>
              item.status === "published" &&
              item.kind === section &&
              (item.kind === "amazon"
                ? settings.recommendations_enabled
                : settings.enabled),
          ).length === 0 && (
            <View
              style={[ui.card, { backgroundColor: colors.sagePale, gap: 12 }]}
            >
              <Text style={ui.heading}>
                {section === "amazon"
                  ? "Stiamo preparando la nostra selezione."
                  : "I prodotti della dottoressa, presto qui."}
              </Text>
              <Text style={ui.body}>
                Prodotti, immagini e disponibilità saranno mostrati quando il
                catalogo sarà pronto. Gli esempi di stile non sono acquistabili.
              </Text>
            </View>
          )}
          <View
            style={{
              flexDirection: width >= 750 ? "row" : "column",
              flexWrap: "wrap",
              gap: 18,
            }}
          >
            {products
              .filter(
                (item) =>
                  item.status === "published" &&
                  item.kind === section &&
                  (item.kind === "amazon"
                    ? settings.recommendations_enabled
                    : settings.enabled),
              )
              .map((item) => (
                <View
                  key={item.id}
                  style={[
                    ui.card,
                    { width: width >= 750 ? "48%" : "100%", gap: 14 },
                  ]}
                >
                  <Image
                    source={item.image_url ? { uri: item.image_url } : logo}
                    accessibilityLabel={
                      item.image_url ? item.title : "metiMaia"
                    }
                    resizeMode="contain"
                    style={{
                      height: 230,
                      width: "100%",
                      backgroundColor: colors.cream,
                      borderRadius: 18,
                    }}
                  />
                  <Text style={ui.label}>
                    {item.kind === "amazon"
                      ? "SELEZIONATO SU AMAZON"
                      : "I PRODOTTI DELLA DOTTORESSA"}
                  </Text>
                  <Text style={ui.heading}>{item.title}</Text>
                  <Text style={ui.body}>{item.description}</Text>
                  {item.kind === "doctor" && (
                    <Text style={[ui.heading, { fontSize: 24 }]}>
                      {formatPrice(item.price_cents)}
                    </Text>
                  )}
                  <Text style={ui.body}>
                    {item.kind === "amazon"
                      ? "Prezzo e disponibilità aggiornati sono indicati su Amazon."
                      : "Consulta spedizione e condizioni di vendita prima di acquistare."}
                  </Text>
                  <Button
                    disabled={
                      item.kind === "amazon"
                        ? !validAmazonLink(item.checkout_url)
                        : !validCheckout(item.checkout_url)
                    }
                    onPress={() => {
                      if (item.kind === "amazon") {
                        if (validAmazonLink(item.checkout_url))
                          void Linking.openURL(item.checkout_url).catch(() =>
                            setMessage("Non è stato possibile aprire Amazon."),
                          );
                      } else {
                        setCheckout(item);
                        setMessage("");
                      }
                    }}
                  >
                    {item.kind === "amazon"
                      ? `Vedi su Amazon: ${item.title}`
                      : `Acquista ${item.title}`}
                  </Button>
                </View>
              ))}
          </View>
          {!settings.enabled && !settings.recommendations_enabled && (
            <>
              <Text style={ui.heading}>
                Due modi per trovare ciò che cerchi.
              </Text>
              <View
                style={{
                  flexDirection: width >= 900 ? "row" : "column",
                  gap: 18,
                }}
              >
                <CollectionIdea
                  kind="book"
                  title="Scelti per voi"
                  text="Una selezione di prodotti da scoprire su Amazon."
                />
                <CollectionIdea
                  kind="cup"
                  title="I prodotti della dottoressa"
                  text="Uno spazio per oli e prodotti della Dott.ssa Gaia Brunetti."
                />
                <CollectionIdea
                  kind="bag"
                  title="Per i più piccoli"
                  text="Oggetti e accessori: il catalogo reale sarà definito dalla dottoressa."
                />
              </View>
            </>
          )}
          <View style={[ui.card, { gap: 16 }]}>
            <Text style={ui.heading}>Acquisti e informazioni</Text>
            {settings.enabled ? (
              <>
                <Text style={ui.label}>Il venditore</Text>
                <Text style={ui.body}>
                  {settings.seller_name}
                  {"\n"}
                  {settings.seller_address}
                  {"\n"}
                  {settings.tax_details}
                  {"\n"}
                  {settings.seller_contact}
                </Text>
                <Text style={ui.label}>Spedizioni</Text>
                <Text style={ui.body}>{settings.shipping_terms}</Text>
                <Text style={ui.label}>Resi e recesso</Text>
                <Text style={ui.body}>{settings.returns_terms}</Text>
                <Button
                  variant="quiet"
                  onPress={() => {
                    if (settings.terms_url.startsWith("https://"))
                      void Linking.openURL(settings.terms_url).catch(() =>
                        setMessage(
                          "Non è stato possibile aprire le condizioni di vendita.",
                        ),
                      );
                  }}
                >
                  Condizioni di vendita
                </Button>
              </>
            ) : (
              <Text style={ui.body}>
                La vendita diretta della dottoressa non è ancora attiva. Per i
                prodotti Amazon, ordini e assistenza seguono le condizioni del
                venditore indicate su Amazon.
              </Text>
            )}
            <Button variant="quiet" onPress={() => router.push("/newsletter")}>
              Ricevi gli aggiornamenti di metiMaia
            </Button>
          </View>
        </>
      )}
      {checkout && settings.enabled && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setCheckout(null)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(48,58,53,0.45)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <View
              style={[ui.card, { width: "100%", maxWidth: 520, gap: 15 }]}
              accessibilityViewIsModal
            >
              <Text style={ui.heading}>Prosegui al pagamento</Text>
              <Text style={ui.body}>
                {checkout.title} · {formatPrice(checkout.price_cents)}. Il
                pagamento si apre su Stripe. Controlla variante, disponibilità,
                importo totale e spedizione nel riepilogo prima di pagare. Le
                informazioni della carta non vengono inserite in metiMaia.
              </Text>
              <Button onPress={() => void openCheckout()}>
                Continua su Stripe
              </Button>
              <Button variant="quiet" onPress={() => setCheckout(null)}>
                Annulla acquisto
              </Button>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
