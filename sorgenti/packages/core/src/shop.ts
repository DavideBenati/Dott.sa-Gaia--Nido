export interface ShopProduct {
  id: string;
  kind: "amazon" | "doctor";
  title: string;
  description: string;
  price_cents: number;
  image_url: string;
  checkout_url: string;
  status: "draft" | "published";
}
export interface ShopSettings {
  id: number;
  enabled: boolean;
  recommendations_enabled: boolean;
  amazon_affiliate: boolean;
  seller_name: string;
  seller_address: string;
  seller_contact: string;
  tax_details: string;
  shipping_terms: string;
  returns_terms: string;
  terms_url: string;
}
export const emptyShopSettings: ShopSettings = {
  id: 1,
  enabled: false,
  recommendations_enabled: false,
  amazon_affiliate: false,
  seller_name: "",
  seller_address: "",
  seller_contact: "",
  tax_details: "",
  shipping_terms: "",
  returns_terms: "",
  terms_url: "",
};
export function validCheckout(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "buy.stripe.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}
export function validAmazonLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["amazon.it", "www.amazon.it", "amzn.to", "amzn.eu"].includes(
        url.hostname,
      ) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}
export function parsePrice(value: string): number | null {
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value.trim().replace(",", ".")) * 100);
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}
export const formatPrice = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    value / 100,
  );
export function settingsIssues(settings: ShopSettings): string[] {
  if (!settings.enabled) return [];
  const issues: string[] = [];
  if (
    [
      settings.seller_name,
      settings.seller_address,
      settings.tax_details,
      settings.shipping_terms,
      settings.returns_terms,
    ].some((v) => v.trim().length < 5)
  )
    issues.push(
      "Completa dati del venditore, dati fiscali, spedizioni e resi prima di attivare le vendite.",
    );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.seller_contact.trim()))
    issues.push("Inserisci l’email di assistenza del venditore.");
  try {
    if (new URL(settings.terms_url).protocol !== "https:") throw new Error();
  } catch {
    issues.push("Inserisci un link HTTPS alle condizioni di vendita.");
  }
  return issues;
}
