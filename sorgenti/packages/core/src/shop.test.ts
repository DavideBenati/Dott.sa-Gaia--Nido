import { describe, expect, test } from "vitest";
import {
  emptyShopSettings,
  parsePrice,
  publicAmazonProducts,
  type ShopProduct,
  settingsIssues,
  validAmazonLink,
  validCheckout,
} from "./shop";
describe("shop links, prices and activation", () => {
  test("accepts euro decimals without silently converting invalid or negative amounts", () => {
    expect(parsePrice("19,90")).toBe(1990);
    expect(parsePrice("0.50")).toBe(50);
    for (const price of ["-1", "0", "free", "19,999", "1e3", "1.234,00"])
      expect(parsePrice(price)).toBeNull();
  });
  test("payment links cannot use a spoofed domain or executable scheme", () => {
    expect(validCheckout("https://buy.stripe.com/test_link")).toBe(true);
    for (const url of [
      "javascript:alert(1)",
      "https://buy.stripe.com.evil.test/x",
      "https://buy.stripe.com@evil.test/x",
      "http://buy.stripe.com/x",
    ])
      expect(validCheckout(url)).toBe(false);
  });
  test("Amazon recommendations only open supported Amazon domains", () => {
    for (const url of [
      "https://www.amazon.it/dp/TEST?tag=example-21",
      "https://amzn.to/TEST",
      "https://amzn.eu/d/TEST",
    ])
      expect(validAmazonLink(url)).toBe(true);
    for (const url of [
      "https://amazon.it.evil.test/dp/X",
      "https://amazon.it@evil.test/x",
      "javascript:alert(1)",
      "https://example.org/product",
    ])
      expect(validAmazonLink(url)).toBe(false);
  });
  test("recommendations can be enabled independently; direct selling requires seller disclosures", () => {
    expect(
      settingsIssues({ ...emptyShopSettings, recommendations_enabled: true }),
    ).toEqual([]);
    expect(
      settingsIssues({ ...emptyShopSettings, enabled: true }).length,
    ).toBeGreaterThan(0);
  });
});

describe("Amazon-only showcase", () => {
  test("hides legacy own products, drafts and unsafe links even when old direct selling is enabled", () => {
    const item: ShopProduct = {
      id: "a",
      kind: "amazon",
      title: "Libro",
      description: "Lettura",
      price_cents: 0,
      image_url: "",
      checkout_url: "https://www.amazon.it/dp/TEST?tag=example-21",
      status: "published",
    };
    const products: ShopProduct[] = [
      item,
      {
        ...item,
        id: "b",
        kind: "doctor",
        checkout_url: "https://buy.stripe.com/TEST",
      },
      { ...item, id: "c", status: "draft" },
      { ...item, id: "d", checkout_url: "https://amazon.it.evil.test/dp/TEST" },
    ];
    const settings = {
      ...emptyShopSettings,
      enabled: true,
      recommendations_enabled: true,
    };
    expect(publicAmazonProducts(products, settings)).toEqual([item]);
    expect(
      publicAmazonProducts(products, {
        ...settings,
        recommendations_enabled: false,
      }),
    ).toEqual([]);
  });
});
