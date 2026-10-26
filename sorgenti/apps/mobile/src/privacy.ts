// Public legal details only. Complete and independently review before enabling
// personal-data services. These are not secrets and must match actual operations.
export const privacyDetails = {
  // Legal identity must remain exactly as configured, independently of SEO.
  controller: process.env.EXPO_PUBLIC_PRIVACY_CONTROLLER ?? "Dott.sa Gaia",
  address:
    process.env.EXPO_PUBLIC_PRIVACY_ADDRESS ??
    "Via San Godenzo 33, Roma, Italia",
  email: process.env.EXPO_PUBLIC_PRIVACY_EMAIL ?? "ostetricamaia@gmail.com",
  dpo: process.env.EXPO_PUBLIC_PRIVACY_DPO ?? "",
  providers: process.env.EXPO_PUBLIC_PRIVACY_PROVIDERS ?? "",
  retention: process.env.EXPO_PUBLIC_PRIVACY_RETENTION ?? "",
  transfers: process.env.EXPO_PUBLIC_PRIVACY_TRANSFERS ?? "",
};
export const privacyComplete = Boolean(
  privacyDetails.controller &&
  privacyDetails.address &&
  privacyDetails.email &&
  privacyDetails.providers &&
  privacyDetails.retention &&
  privacyDetails.transfers,
);
