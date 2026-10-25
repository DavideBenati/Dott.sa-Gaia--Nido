import { client } from "./state";
import {
  emptyShopSettings,
  validAmazonLink,
  publicProfessionalText,
  type ShopProduct,
  type ShopSettings,
} from "@nido/core";
export {
  emptyShopSettings,
  publicAmazonProducts,
  validAmazonLink,
  type ShopProduct,
  type ShopSettings,
} from "@nido/core";
export async function loadShop(editor = false) {
  if (!client)
    return { products: [] as ShopProduct[], settings: emptyShopSettings };
  if (editor) {
    const { assertEditor } = await import("@nido/data");
    await assertEditor(client);
  }
  const [products, settings] = await Promise.all([
    client
      .from("shop_products")
      .select(
        "id,kind,title,description,price_cents,image_url,checkout_url,status",
      )
      .order("created_at", { ascending: false })
      .order("id"),
    client.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (products.error || settings.error)
    throw new Error(
      "Consigli d’acquisto non ancora configurati o temporaneamente non disponibili.",
    );
  const loaded = {
    products: (products.data as ShopProduct[]).filter(
      (product) => product.kind === "amazon",
    ),
    settings: {
      ...((settings.data as ShopSettings | null) ?? emptyShopSettings),
      enabled: false,
    },
  };
  if (editor) return loaded;
  return {
    products: loaded.products.map((product) => ({
      ...product,
      title: publicProfessionalText(product.title),
      description: publicProfessionalText(product.description),
    })),
    settings: {
      ...loaded.settings,
      seller_name: publicProfessionalText(loaded.settings.seller_name),
      seller_address: publicProfessionalText(loaded.settings.seller_address),
      tax_details: publicProfessionalText(loaded.settings.tax_details),
      shipping_terms: publicProfessionalText(loaded.settings.shipping_terms),
      returns_terms: publicProfessionalText(loaded.settings.returns_terms),
    },
  };
}
export async function saveShopProduct(product: ShopProduct) {
  if (!client) throw new Error("Servizio non disponibile.");
  const { assertEditor } = await import("@nido/data");
  await assertEditor(client);
  if (product.kind !== "amazon")
    throw new Error("Questa vetrina accetta solo prodotti Amazon.");
  if (product.title.trim().length < 3)
    throw new Error("Inserisci un titolo di almeno 3 caratteri.");
  if (product.status === "published") {
    if (!product.description.trim())
      throw new Error("Completa la descrizione del prodotto.");
    if (product.kind === "amazon" && !validAmazonLink(product.checkout_url))
      throw new Error(
        "Inserisci un link HTTPS Amazon.it, amzn.to o amzn.eu valido.",
      );
  }
  const { error } = await client
    .from("shop_products")
    .upsert({ ...product, kind: "amazon", price_cents: 0 });
  if (error)
    throw new Error(
      "Salvataggio non riuscito. Verifica i campi, i permessi e la configurazione dei consigli d’acquisto.",
    );
}
export async function saveShopSettings(settings: ShopSettings) {
  if (!client) throw new Error("Servizio non disponibile.");
  const { assertEditor } = await import("@nido/data");
  await assertEditor(client);
  const { error } = await client
    .from("shop_settings")
    .upsert({ ...settings, enabled: false });
  if (error)
    throw new Error(
      "Configurazione non salvata. Verifica i dati e i permessi.",
    );
}
