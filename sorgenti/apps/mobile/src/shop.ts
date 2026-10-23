import { client } from "./state";
import {
  emptyShopSettings,
  settingsIssues,
  validCheckout,
  validAmazonLink,
  type ShopProduct,
  type ShopSettings,
} from "@nido/core";
export {
  emptyShopSettings,
  formatPrice,
  parsePrice,
  validCheckout,
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
      .order("created_at"),
    client.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (products.error || settings.error)
    throw new Error(
      "Shop non ancora configurato o temporaneamente non disponibile.",
    );
  return {
    products: products.data as ShopProduct[],
    settings: (settings.data as ShopSettings | null) ?? emptyShopSettings,
  };
}
export async function saveShopProduct(product: ShopProduct) {
  if (!client) throw new Error("Servizio non disponibile.");
  const { assertEditor } = await import("@nido/data");
  await assertEditor(client);
  if (product.title.trim().length < 3)
    throw new Error("Inserisci un titolo di almeno 3 caratteri.");
  if (product.status === "published") {
    if (!product.description.trim())
      throw new Error("Completa la descrizione del prodotto.");
    if (product.kind === "amazon" && !validAmazonLink(product.checkout_url))
      throw new Error(
        "Inserisci un link HTTPS Amazon.it, amzn.to o amzn.eu valido.",
      );
    if (
      product.kind === "doctor" &&
      (!validCheckout(product.checkout_url) ||
        !product.image_url.startsWith("https://") ||
        product.price_cents <= 0)
    )
      throw new Error(
        "Per vendere direttamente servono immagine HTTPS, prezzo e un Payment Link Stripe valido.",
      );
  }
  const { error } = await client.from("shop_products").upsert(product);
  if (error)
    throw new Error(
      "Salvataggio non riuscito. Verifica i campi, i permessi e la configurazione shop.",
    );
}
export async function saveShopSettings(settings: ShopSettings) {
  if (!client) throw new Error("Servizio non disponibile.");
  const { assertEditor } = await import("@nido/data");
  await assertEditor(client);
  const issues = settingsIssues(settings);
  if (issues.length) throw new Error(issues.join(" "));
  const { error } = await client.from("shop_settings").upsert(settings);
  if (error)
    throw new Error(
      "Configurazione non salvata. Verifica i dati e i permessi.",
    );
}
