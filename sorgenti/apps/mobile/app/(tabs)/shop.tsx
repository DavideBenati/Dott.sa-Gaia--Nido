import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Linking,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import logo from "../../assets/brand/maia-logo.png";
import { Text, TextInput } from "../../src/typography";
import { Screen, Notice, Button, StageHeading, ui } from "../../src/ui";
import { colors } from "../../src/theme";
import { useApp } from "../../src/state";
import { useEditorAccess } from "../../src/editor-access";
import { useUnsavedChanges } from "../../src/unsaved-changes";
import {
  emptyShopSettings,
  loadShop,
  saveShopProduct,
  saveShopSettings,
  publicAmazonProducts,
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
      eyebrow={
        manage ? "STUDIO · CONSIGLI D’ACQUISTO" : "SCELTI PER LA FAMIGLIA"
      }
      title={manage ? "Gestisci i consigli d’acquisto" : "Consigli d’acquisto"}
      subtitle={
        manage
          ? "Prepara le schede e scegli quali prodotti Amazon mostrare."
          : "Una selezione di prodotti da scoprire su Amazon, con i tuoi tempi e secondo le tue esigenze."
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
  const [management, setManagement] = useState<"products" | "settings">(
    "products",
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "published"
  >("all");
  const [page, setPage] = useState(0);
  const [pageNavigation, setPageNavigation] = useState(0);
  const [version, setVersion] = useState(0);
  const [settingsBaseline, setSettingsBaseline] = useState(
    JSON.stringify(emptyShopSettings),
  );
  const [productBaseline, setProductBaseline] = useState("");
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const busyLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const settingsDirty = JSON.stringify(settings) !== settingsBaseline;
  const productDirty = Boolean(
    product && JSON.stringify(product) !== productBaseline,
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
    if (
      !confirmDiscard(
        "Uscire senza salvare le modifiche ai consigli d’acquisto?",
      )
    )
      return false;
    setSettings(JSON.parse(settingsBaseline) as ShopSettings);
    setProduct(null);
    setProductBaseline("");
    setMessage("");
    return true;
  }
  function editProduct(value: ShopProduct) {
    setProduct(value);
    setProductBaseline(JSON.stringify(value));
    setMessage("");
  }
  const filtered = products.filter(
    (item) =>
      item.kind === "amazon" &&
      (statusFilter === "all" || item.status === statusFilter) &&
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
  const publicProducts = publicAmazonProducts(products, settings).filter(
    (item) =>
      `${item.title} ${item.description}`
        .toLocaleLowerCase("it-IT")
        .includes(query.trim().toLocaleLowerCase("it-IT")),
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
    busyLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const updated: ShopProduct = {
        ...product,
        kind: "amazon",
        price_cents: 0,
        status,
      };
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
          ? "Scheda salvata in bozza. Non è visibile ai visitatori."
          : "Scheda Amazon pubblicata. Sarà visibile quando la selezione Amazon sarà attiva.",
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
        settings.recommendations_enabled
          ? "Impostazioni salvate. I prodotti Amazon pubblicati sono visibili."
          : "Impostazioni salvate. La selezione Amazon è nascosta.",
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
              if (discard()) onManage(!manage);
            }}
          >
            {manage
              ? "Vedi i consigli d’acquisto"
              : "Gestisci i consigli d’acquisto"}
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
        <Notice>Caricamento dei consigli d’acquisto…</Notice>
      ) : manage && editor ? (
        <>
          <View
            style={{ gap: 10, flexDirection: width >= 650 ? "row" : "column" }}
          >
            {(
              [
                ["products", "Schede Amazon"],
                ["settings", "Visibilità e affiliazione"],
              ] as const
            ).map(([value, label]) => (
              <View key={value} style={{ flex: 1 }}>
                <Button
                  variant={management === value ? "secondary" : "quiet"}
                  disabled={busy}
                  onPress={() => {
                    if ((management !== value || product) && !discard()) return;
                    setManagement(value);
                  }}
                >
                  {label}
                </Button>
              </View>
            ))}
          </View>
          <StageHeading id="shop-workspace-heading">
            {product
              ? "Modifica scheda Amazon"
              : management === "settings"
                ? "Visibilità e affiliazione"
                : "Catalogo Amazon"}
          </StageHeading>
          {(settingsDirty || productDirty) && (
            <Notice>Modifiche ai consigli d’acquisto non salvate.</Notice>
          )}
          {loadError ? (
            <View accessibilityRole="alert" style={{ gap: 12 }}>
              {message !== "" && <Notice>{message}</Notice>}
              <Notice>
                Non è stato possibile leggere il catalogo attuale. Riprova prima
                di modificarlo o salvare.
              </Notice>
              <Button onPress={() => setVersion((value) => value + 1)}>
                Riprova caricamento catalogo
              </Button>
            </View>
          ) : product ? (
            <View
              style={[ui.card, { gap: 18 }]}
              pointerEvents={busy ? "none" : "auto"}
            >
              <Text style={ui.heading}>Scheda Amazon</Text>
              <Field
                disabled={busy}
                label="Nome prodotto"
                value={product.title}
                onChange={(title) => setProduct({ ...product, title })}
              />
              <Field
                disabled={busy}
                label="Perché lo consigli"
                value={product.description}
                onChange={(description) =>
                  setProduct({ ...product, description })
                }
                multiline
              />
              <Field
                disabled={busy}
                label="Immagine prodotto (HTTPS, facoltativa)"
                value={product.image_url}
                onChange={(image_url) => setProduct({ ...product, image_url })}
              />
              <Field
                disabled={busy}
                label="Link Amazon"
                value={product.checkout_url}
                onChange={(checkout_url) =>
                  setProduct({ ...product, checkout_url })
                }
              />
              <Notice>
                Inserisci un link al prodotto su Amazon.it oppure il tuo link
                affiliato autorizzato. Prezzo e disponibilità restano su Amazon.
                Usa immagini proprie o autorizzate; puoi lasciare l’immagine
                vuota. Il sito non crea l’affiliazione e non aggiunge
                automaticamente il tuo codice.
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
                Salva scheda in bozza
              </Button>
              <Button
                disabled={busy || loadError}
                variant="secondary"
                onPress={() => void saveProduct("published")}
              >
                Pubblica scheda
              </Button>
              <Button disabled={busy} variant="quiet" onPress={discard}>
                Torna al catalogo
              </Button>
            </View>
          ) : management === "settings" ? (
            <View style={[ui.card, { gap: 18 }]}>
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
                  ho un account Amazon Affiliati abilitato.
                </Text>
              </Pressable>
              <Notice>
                Con l’affiliazione attiva, la pagina indica le commissioni.
                Incolla in ogni scheda il link generato dal tuo account Amazon
                Affiliati. Ordini, pagamenti, spedizione e resi si gestiscono su
                Amazon.
              </Notice>
              {message !== "" && (
                <View accessibilityRole="alert">
                  <Notice>{message}</Notice>
                </View>
              )}
              <Button
                disabled={busy || !settingsDirty || loadError}
                onPress={() => void saveSettings()}
              >
                Salva impostazioni consigli
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
                    kind: "amazon",
                    title: "",
                    description: "",
                    price_cents: 0,
                    image_url: "",
                    checkout_url: "",
                    status: "draft",
                  })
                }
              >
                Nuova scheda Amazon
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
              </View>
              <Text style={ui.body}>
                {filtered.length} prodotti trovati · Pagina {currentPage + 1} di{" "}
                {pages}
              </Text>
              {visibleProducts.length === 0 && (
                <Notice>
                  Nessun prodotto corrisponde ai filtri. Crea una scheda Amazon
                  o cambia la ricerca.
                </Notice>
              )}
              {visibleProducts.map((item) => (
                <View key={item.id} style={[ui.card, { gap: 10 }]}>
                  <Text style={ui.heading}>{item.title}</Text>
                  <Text style={ui.body}>
                    {item.status === "draft" ? "Bozza" : "Pubblicato"} · Amazon
                    · Prezzo su Amazon
                  </Text>
                  {!validAmazonLink(item.checkout_url) && (
                    <Notice>
                      Completa o correggi il link Amazon prima di pubblicare
                      questa scheda.
                    </Notice>
                  )}
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
          <Notice>
            {settings.amazon_affiliate
              ? "In qualità di Affiliato Amazon ricevo un guadagno dagli acquisti idonei. I link di questa selezione possono generare una commissione, senza costi aggiuntivi per te."
              : "Questa selezione può contenere link affiliati: acquistando tramite questi collegamenti, metiMaia può ricevere una commissione, senza costi aggiuntivi per te."}
          </Notice>
          <Text style={ui.body}>
            Scegli ciò che è utile per la tua famiglia. Prezzo aggiornato,
            disponibilità, venditore, spedizione e resi sono indicati su Amazon.
            L’acquisto si conclude lì.
          </Text>
          {loadError ? (
            <View accessibilityRole="alert" style={{ gap: 12 }}>
              <Notice>
                Non è stato possibile caricare la selezione. Riprova tra poco.
              </Notice>
              <Button
                variant="secondary"
                onPress={() => setVersion((value) => value + 1)}
              >
                Riprova caricamento catalogo
              </Button>
            </View>
          ) : (
            <>
              {settings.recommendations_enabled && products.length > 0 && (
                <Field
                  label="Cerca nella selezione Amazon"
                  value={query}
                  onChange={setQuery}
                />
              )}
              {publicProducts.length === 0 && (
                <View
                  style={[
                    ui.card,
                    { backgroundColor: colors.sagePale, gap: 12 },
                  ]}
                >
                  <Text style={ui.heading}>
                    {query.trim() && settings.recommendations_enabled
                      ? "Nessun prodotto trovato."
                      : "La selezione è in preparazione."}
                  </Text>
                  <Text style={ui.body}>
                    {query.trim() && settings.recommendations_enabled
                      ? "Prova con un’altra parola o cancella la ricerca."
                      : "Qui troverai i prodotti scelti da Gaia, con una breve spiegazione e il collegamento ad Amazon."}
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
                {publicProducts.map((item) => (
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
                    <Text style={ui.label}>SELEZIONATO SU AMAZON</Text>
                    <Text style={ui.heading}>{item.title}</Text>
                    <Text style={ui.body}>{item.description}</Text>
                    <Text style={ui.body}>
                      Prezzo e disponibilità aggiornati su Amazon.
                    </Text>
                    <Text style={ui.label}>
                      Link esterno Amazon · può essere affiliato
                    </Text>
                    <Button
                      onPress={() => {
                        if (validAmazonLink(item.checkout_url))
                          void Linking.openURL(item.checkout_url).catch(() =>
                            setMessage(
                              "Non è stato possibile aprire Amazon. Riprova tra poco.",
                            ),
                          );
                      }}
                    >{`Vedi su Amazon: ${item.title}`}</Button>
                  </View>
                ))}
              </View>
            </>
          )}
          <View style={[ui.card, { gap: 16 }]}>
            <Text style={ui.heading}>Prima di scegliere</Text>
            <Text style={ui.body}>
              Leggi caratteristiche, materiali, istruzioni e limiti d’età
              indicati dal produttore. I consigli d’acquisto non sostituiscono
              una valutazione professionale. Per ordini e assistenza fai
              riferimento al venditore indicato su Amazon.
            </Text>
            <Button variant="quiet" onPress={() => router.push("/newsletter")}>
              Ricevi gli aggiornamenti di metiMaia
            </Button>
          </View>
        </>
      )}
    </View>
  );
}
