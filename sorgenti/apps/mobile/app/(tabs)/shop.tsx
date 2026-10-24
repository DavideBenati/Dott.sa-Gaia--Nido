import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Linking,
  Pressable,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import logo from "../../assets/brand/maia-logo.png";
import { Text, TextInput } from "../../src/typography";
import { Screen, Notice, Button, StageHeading, ui } from "../../src/ui";
import { colors } from "../../src/theme";
import { useDialogFocus } from "../../src/dialog-focus";
import { useApp } from "../../src/state";
import { useEditorAccess } from "../../src/editor-access";
import { useUnsavedChanges } from "../../src/unsaved-changes";
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        editable={!disabled}
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
  const params = useLocalSearchParams<{ manage?: string }>();
  const manage = allowed && params.manage === "1";
  const [phase, setPhase] = useState("public");
  return (
    <Screen
      professional={manage}
      stageKey={phase}
      focusTargetId="shop-workspace-heading"
      stageScroll="heading"
      eyebrow={manage ? "STUDIO · SHOP" : "IL MONDO METIMAIA"}
      title={manage ? "Gestione Shop" : "Lo Shop di metiMaia"}
      subtitle={
        manage
          ? "Prodotti, selezione Amazon e impostazioni di vendita."
          : "La selezione Amazon e i prodotti della Dott.ssa Gaia Brunetti."
      }
    >
      <ShopContent
        key={email ?? "guest"}
        editor={allowed}
        manage={manage}
        onManage={(value) => router.setParams({ manage: value ? "1" : "0" })}
        onPhase={setPhase}
      />
    </Screen>
  );
}
function ShopContent({
  editor,
  manage,
  onManage,
  onPhase,
}: {
  editor: boolean;
  manage: boolean;
  onManage: (value: boolean) => void;
  onPhase: (value: string) => void;
}) {
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState<ShopSettings>(emptyShopSettings);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [section, setSection] = useState<"amazon" | "doctor">("amazon");
  const [management, setManagement] = useState<"products" | "settings">(
    "products",
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published"
  >("all");
  const [kindFilter, setKindFilter] = useState<"all" | "amazon" | "doctor">(
    "all",
  );
  const [page, setPage] = useState(0);
  const [pageNavigation, setPageNavigation] = useState(0);
  const [version, setVersion] = useState(0);
  const [settingsBaseline, setSettingsBaseline] = useState(
    JSON.stringify(emptyShopSettings),
  );
  const [productBaseline, setProductBaseline] = useState("");
  const busyLock = useRef(false);
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [checkout, setCheckout] = useState<ShopProduct | null>(null);
  const settingsDirty = JSON.stringify(settings) !== settingsBaseline;
  const productDirty = Boolean(
    product && JSON.stringify({ product, price }) !== productBaseline,
  );
  const { confirmDiscard, allowNavigation } = useUnsavedChanges(
    manage && (settingsDirty || productDirty),
  );
  useEffect(() => {
    onPhase(
      manage
        ? `${management}-${product?.id ?? "list"}-${pageNavigation}`
        : "public",
    );
  }, [manage, management, product?.id, pageNavigation, onPhase]);
  function discard() {
    if (!confirmDiscard("Uscire senza salvare le modifiche dello Shop?"))
      return false;
    setSettings(JSON.parse(settingsBaseline) as ShopSettings);
    setProduct(null);
    setProductBaseline("");
    setMessage("");
    return true;
  }
  function editProduct(value: ShopProduct) {
    const nextPrice = value.price_cents
      ? (value.price_cents / 100).toFixed(2)
      : "";
    setProduct(value);
    setPrice(nextPrice);
    setProductBaseline(JSON.stringify({ product: value, price: nextPrice }));
    setMessage("");
  }
  const filtered = products.filter(
    (item) =>
      (statusFilter === "all" || item.status === statusFilter) &&
      (kindFilter === "all" || item.kind === kindFilter) &&
      `${item.title} ${item.description}`
        .toLocaleLowerCase("it-IT")
        .includes(query.trim().toLocaleLowerCase("it-IT")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages - 1);
  const visibleProducts = filtered.slice(
    currentPage * 12,
    currentPage * 12 + 12,
  );

  useDialogFocus(Boolean(checkout), "metimaia-checkout", () =>
    setCheckout(null),
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadShop(editor)
      .then((data) => {
        if (active) {
          setSettings(data.settings);
          setSettingsBaseline(JSON.stringify(data.settings));
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
  }, [editor, version]);
  async function reload() {
    const data = await loadShop(editor);
    setProducts(data.products);
    setSettings(data.settings);
    setSettingsBaseline(JSON.stringify(data.settings));
    setLoadError(false);
  }
  async function saveProduct(status: ShopProduct["status"]) {
    if (!product || busyLock.current || loading || loadError) return;
    const cents = product.kind === "doctor" ? parsePrice(price) : 0;
    if (product.kind === "doctor" && price.trim() && cents === null) {
      setMessage(
        "Inserisci un prezzo positivo in euro, con massimo due decimali (esempio: 19,90).",
      );
      return;
    }
    busyLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const updated = { ...product, price_cents: cents ?? 0, status };
      await saveShopProduct(updated);
      setProducts((items) => [
        updated,
        ...items.filter((item) => item.id !== updated.id),
      ]);
      setProduct(null);
      setProductBaseline("");
      setPage(0);
      try {
        await reload();
      } catch {
        setLoadError(true);
      }
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
      busyLock.current = false;
      setBusy(false);
    }
  }
  async function saveSettings() {
    if (busyLock.current || loading || loadError || !settingsDirty) return;
    busyLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await saveShopSettings(settings);
      setSettingsBaseline(JSON.stringify(settings));
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
      busyLock.current = false;
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
        <View style={{ gap: 10 }}>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => {
              if (!discard()) return;
              onManage(!manage);
            }}
          >
            {manage ? "Vedi lo shop" : "Gestisci prodotti e vendite"}
          </Button>
          {manage && (
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => allowNavigation(() => router.push("/studio"))}
            >
              Torna a Studio
            </Button>
          )}
        </View>
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
          <View
            style={{ gap: 10, flexDirection: width >= 650 ? "row" : "column" }}
          >
            <View style={{ flex: 1 }}>
              <Button
                variant={management === "products" ? "secondary" : "quiet"}
                disabled={busy}
                onPress={() => {
                  if ((management !== "products" || product) && !discard())
                    return;
                  setManagement("products");
                }}
              >
                Prodotti
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant={management === "settings" ? "secondary" : "quiet"}
                disabled={busy}
                onPress={() => {
                  if (management !== "settings" && !discard()) return;
                  setManagement("settings");
                }}
              >
                Impostazioni vendita
              </Button>
            </View>
          </View>
          <StageHeading id="shop-workspace-heading">
            {product
              ? "Modifica prodotto"
              : management === "settings"
                ? "Impostazioni di vendita"
                : "Catalogo prodotti"}
          </StageHeading>
          {(settingsDirty || productDirty) && (
            <Notice>Modifiche allo Shop non salvate.</Notice>
          )}
          {loadError ? (
            <View accessibilityRole="alert" style={{ gap: 12 }}>
              {message !== "" && <Notice>{message}</Notice>}
              <Notice>
                Non è stato possibile leggere i dati attuali dello Shop. Riprova
                prima di modificarli o salvare.
              </Notice>
              <Button onPress={() => setVersion((value) => value + 1)}>
                Riprova caricamento shop
              </Button>
            </View>
          ) : product ? (
            <View
              style={[ui.card, { gap: 18 }]}
              pointerEvents={busy ? "none" : "auto"}
            >
              <Text style={ui.heading}>Scheda prodotto</Text>
              <Text style={ui.label}>Tipo di scheda</Text>
              <Button
                disabled={busy}
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
                disabled={busy}
                variant={product.kind === "doctor" ? "secondary" : "quiet"}
                onPress={() =>
                  setProduct({ ...product, kind: "doctor", checkout_url: "" })
                }
              >
                Prodotto della dottoressa
              </Button>
              <Field
                disabled={busy}
                label="Nome prodotto"
                value={product.title}
                onChange={(title) => setProduct({ ...product, title })}
              />
              <Field
                disabled={busy}
                label="Descrizione prodotto"
                value={product.description}
                onChange={(description) =>
                  setProduct({ ...product, description })
                }
                multiline
              />
              {product.kind === "doctor" && (
                <Field
                  disabled={busy}
                  label="Prezzo in euro"
                  value={price}
                  onChange={setPrice}
                />
              )}
              <Field
                disabled={busy}
                label="Immagine prodotto (HTTPS)"
                value={product.image_url}
                onChange={(image_url) => setProduct({ ...product, image_url })}
              />
              <Field
                disabled={busy}
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
              {product.kind === "doctor" && (
                <Notice>
                  Prima di pubblicare completa nella descrizione
                  caratteristiche, modalità d’uso, ingredienti/materiali ed
                  eventuali avvertenze o limiti d’età pertinenti. Verifica i
                  dati con la documentazione del produttore: non inventare
                  indicazioni o benefici sanitari.
                </Notice>
              )}
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
              <Button
                disabled={busy || loadError}
                onPress={() => void saveProduct("draft")}
              >
                Salva prodotto in bozza
              </Button>
              <Button
                disabled={busy || loadError}
                variant="secondary"
                onPress={() => void saveProduct("published")}
              >
                Pubblica prodotto
              </Button>
              <Button
                disabled={busy}
                variant="quiet"
                onPress={() => {
                  if (!discard()) return;
                }}
              >
                Annulla modifica prodotto
              </Button>
            </View>
          ) : management === "settings" ? (
            <View
              style={[ui.card, { gap: 18 }]}
              pointerEvents={busy ? "none" : "auto"}
            >
              <Text style={ui.heading}>Selezione Amazon</Text>
              <Pressable
                disabled={busy}
                accessibilityRole="checkbox"
                accessibilityLabel="Mostra selezione Amazon"
                accessibilityState={{
                  checked: settings.recommendations_enabled,
                }}
                onPress={() =>
                  setSettings({
                    ...settings,
                    recommendations_enabled: !settings.recommendations_enabled,
                  })
                }
              >
                <Text style={ui.body}>
                  {settings.recommendations_enabled ? "☑" : "☐"} Mostra i
                  prodotti Amazon pubblicati.
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
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
                Per avviare la vendita servono dati reali, condizioni di vendita
                e un account di pagamento attivo. L’inserimento dei campi non
                sostituisce la verifica degli obblighi fiscali e di vendita.
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
                  disabled={busy}
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
                disabled={busy}
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
              <Button
                disabled={busy || !settingsDirty || loadError}
                onPress={() => void saveSettings()}
              >
                Salva impostazioni shop
              </Button>
            </View>
          ) : (
            <>
              {message !== "" && (
                <View
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Notice>{message}</Notice>
                </View>
              )}
              <Button
                onPress={() =>
                  editProduct({
                    id: crypto.randomUUID(),
                    kind: "doctor",
                    title: "",
                    description: "",
                    price_cents: 0,
                    image_url: "",
                    checkout_url: "",
                    status: "draft",
                  })
                }
              >
                Nuovo prodotto
              </Button>
              <Field
                label="Cerca prodotti per nome o descrizione"
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(0);
                }}
              />
              <View style={{ gap: 8 }}>
                <Text style={ui.label}>Stato</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {(
                    [
                      ["all", "Tutti"],
                      ["draft", "Bozze"],
                      ["published", "Pubblicati"],
                    ] as const
                  ).map(([value, label]) => (
                    <View key={value} style={{ flexGrow: 1, minWidth: 90 }}>
                      <Button
                        variant={statusFilter === value ? "secondary" : "quiet"}
                        accessibilityLabel={`Filtra prodotti: ${label}`}
                        onPress={() => {
                          setStatusFilter(value);
                          setPage(0);
                        }}
                      >{`${statusFilter === value ? "✓ " : ""}${label}`}</Button>
                    </View>
                  ))}
                </View>
                <Text style={ui.label}>Tipo di prodotto</Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {(
                    [
                      ["all", "Tutti"],
                      ["amazon", "Amazon"],
                      ["doctor", "Dottoressa"],
                    ] as const
                  ).map(([value, label]) => (
                    <View key={value} style={{ flexGrow: 1, minWidth: 90 }}>
                      <Button
                        variant={kindFilter === value ? "secondary" : "quiet"}
                        accessibilityLabel={`Tipo prodotto: ${label}`}
                        onPress={() => {
                          setKindFilter(value);
                          setPage(0);
                        }}
                      >{`${kindFilter === value ? "✓ " : ""}${label}`}</Button>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={ui.body}>
                {filtered.length} prodotti trovati · Pagina {currentPage + 1} di{" "}
                {pages}
              </Text>
              {visibleProducts.length === 0 && (
                <Notice>
                  Nessun prodotto corrisponde ai filtri. Puoi creare una nuova
                  scheda o cambiare la ricerca.
                </Notice>
              )}
              {visibleProducts.map((item) => (
                <View key={item.id} style={[ui.card, { gap: 10 }]}>
                  <Text style={ui.heading}>{item.title}</Text>
                  <Text style={ui.body}>
                    {item.status === "draft" ? "Bozza" : "Pubblicato"} ·{" "}
                    {item.kind === "amazon"
                      ? "Amazon"
                      : "Prodotto della dottoressa"}{" "}
                    ·{" "}
                    {item.price_cents > 0
                      ? formatPrice(item.price_cents)
                      : item.kind === "amazon"
                        ? "Prezzo su Amazon"
                        : "Prezzo da definire"}
                  </Text>
                  <Button
                    variant="secondary"
                    onPress={() => editProduct({ ...item })}
                  >{`Modifica ${item.title}`}</Button>
                </View>
              ))}
              <Button
                variant="quiet"
                disabled={currentPage === 0}
                onPress={() => {
                  setPage(currentPage - 1);
                  setPageNavigation((value) => value + 1);
                }}
              >
                Pagina prodotti precedente
              </Button>
              <Button
                variant="quiet"
                disabled={currentPage + 1 >= pages}
                onPress={() => {
                  setPage(currentPage + 1);
                  setPageNavigation((value) => value + 1);
                }}
              >
                Altri prodotti
              </Button>
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
            <ScrollView
              style={{
                width: "100%",
                maxWidth: 520,
                maxHeight: "90%",
                flexGrow: 0,
              }}
              contentContainerStyle={[ui.card, { gap: 15 }]}
              nativeID="metimaia-checkout"
              role="dialog"
              accessibilityLabel="Conferma apertura pagamento Stripe"
              accessibilityViewIsModal
            >
              <Text style={ui.heading}>Prosegui al pagamento</Text>
              <Text style={ui.body}>Venditore: {settings.seller_name}</Text>
              <Text style={ui.body}>Spedizioni: {settings.shipping_terms}</Text>
              <Text style={ui.body}>
                Resi e recesso: {settings.returns_terms}
              </Text>
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
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}
