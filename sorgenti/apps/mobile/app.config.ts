import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseUrl = process.env.NIDO_WEB_BASE_PATH;
  return {
    ...config,
    name: config.name ?? "Nido",
    slug: config.slug ?? "nido-companion",
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
