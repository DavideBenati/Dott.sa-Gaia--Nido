import { describe, expect, it } from "vitest";
import {
  androidInstallBrowser,
  installPlatform,
  keepInstalledHome,
  serviceWorkerOriginAllowed,
  standaloneDisplay,
} from "../apps/mobile/src/pwa-platform";

describe("installed web app platform and launch", () => {
  it("offers Samsung's guide before matching its Chrome token and directs embedded or unknown browsers to the explicit Chrome path", () => {
    expect(
      androidInstallBrowser(
        "Mozilla/5.0 (Linux; Android 15) Chrome/140.0 SamsungBrowser/28.0 Mobile Safari/537.36",
      ),
    ).toBe("samsung");
    expect(
      androidInstallBrowser(
        "Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36",
      ),
    ).toBe("chrome");
    expect(
      androidInstallBrowser(
        "Mozilla/5.0 (Linux; Android 15; wv) Chrome/140.0 Instagram",
      ),
    ).toBe("chrome");
    expect(androidInstallBrowser("")).toBe("chrome");
  });
  it("detects iPhone, touch iPad desktop mode and Android without treating all Macs as iPads", () => {
    expect(installPlatform({ userAgent: "Mozilla/5.0 (iPhone)" })).toBe("ios");
    expect(
      installPlatform({
        userAgent: "Macintosh",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
    expect(
      installPlatform({
        userAgent: "Macintosh",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
    expect(
      installPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 15)" }),
    ).toBe("android");
  });

  it("uses real standalone flags and leaves an ordinary browser unchanged", () => {
    expect(standaloneDisplay({ displayMode: false })).toBe(false);
    expect(standaloneDisplay({ displayMode: true })).toBe(true);
    expect(
      standaloneDisplay({ displayMode: false, navigatorStandalone: true }),
    ).toBe(true);
    expect(
      standaloneDisplay({ displayMode: false, navigatorStandalone: false }),
    ).toBe(false);
  });

  it("registers only on HTTPS or local development HTTP", () => {
    expect(
      serviceWorkerOriginAllowed({
        protocol: "https:",
        hostname: "metimaia.com",
      }),
    ).toBe(true);
    expect(
      serviceWorkerOriginAllowed({ protocol: "http:", hostname: "localhost" }),
    ).toBe(true);
    expect(
      serviceWorkerOriginAllowed({ protocol: "http:", hostname: "127.0.0.1" }),
    ).toBe(true);
    expect(
      serviceWorkerOriginAllowed({
        protocol: "http:",
        hostname: "metimaia.com",
      }),
    ).toBe(false);
    expect(
      serviceWorkerOriginAllowed({ protocol: "file:", hostname: "" }),
    ).toBe(false);
  });

  it("keeps a completed installed user's cold launch on Home without changing explicit destinations", () => {
    const request = {
      standalone: true,
      pathname: "/",
      hasEntry: false,
      completeProfile: true,
      passwordRecovery: false,
    };
    expect(keepInstalledHome(request)).toBe(true);
    expect(keepInstalledHome({ ...request, standalone: false })).toBe(false);
    expect(keepInstalledHome({ ...request, hasEntry: true })).toBe(false);
    expect(keepInstalledHome({ ...request, completeProfile: false })).toBe(
      false,
    );
    expect(keepInstalledHome({ ...request, passwordRecovery: true })).toBe(
      false,
    );
    expect(keepInstalledHome({ ...request, returnTo: "documents" })).toBe(
      false,
    );
    expect(keepInstalledHome({ ...request, returnTo: "video_calls" })).toBe(
      false,
    );
    expect(
      keepInstalledHome({
        ...request,
        returnTo: "video_calls:33333333-3333-4333-8333-333333333333",
      }),
    ).toBe(false);
    expect(
      keepInstalledHome({
        ...request,
        returnTo: "video_calls:https://example.invalid",
      }),
    ).toBe(true);
    expect(keepInstalledHome({ ...request, pathname: "/account" })).toBe(false);
    expect(keepInstalledHome({ ...request, pathname: "/miei-documenti" })).toBe(
      false,
    );
  });
});
