export type InstallPlatform = "ios" | "android" | "desktop";

/** Pick a guide; unknown and embedded browsers get the explicit Chrome path. */
export function androidInstallBrowser(userAgent: string): "chrome" | "samsung" {
  return /SamsungBrowser\//i.test(userAgent) ? "samsung" : "chrome";
}

export function installPlatform({
  userAgent,
  platform = "",
  maxTouchPoints = 0,
}: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): InstallPlatform {
  if (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  )
    return "ios";
  return /Android/i.test(userAgent) ? "android" : "desktop";
}

export function standaloneDisplay({
  displayMode,
  navigatorStandalone,
}: {
  displayMode: boolean;
  navigatorStandalone?: boolean;
}) {
  return displayMode || navigatorStandalone === true;
}

export function serviceWorkerOriginAllowed({
  protocol,
  hostname,
}: {
  protocol: string;
  hostname: string;
}) {
  return (
    protocol === "https:" ||
    (protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname))
  );
}

export function keepInstalledHome({
  standalone,
  pathname,
  hasEntry,
  completeProfile,
  passwordRecovery,
  returnTo,
}: {
  standalone: boolean;
  pathname: string;
  hasEntry: boolean;
  completeProfile: boolean;
  passwordRecovery: boolean;
  returnTo?: unknown;
}) {
  return (
    standalone &&
    pathname === "/" &&
    !hasEntry &&
    completeProfile &&
    !passwordRecovery &&
    returnTo !== "documents"
  );
}
