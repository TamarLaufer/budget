import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic additions on top of app.json.
 *
 * Android 9+ blocks plain-HTTP requests. They are allowed only when the build's API URL is
 * itself http:// (testing against a backend on your LAN). Production builds must use https://.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  return {
    ...config,
    name: config.name ?? "Spendo",
    slug: config.slug ?? "spendo",
    plugins: [
      ...(config.plugins ?? []),
      ["expo-build-properties", { android: { usesCleartextTraffic: apiUrl.startsWith("http://") } }],
    ],
  };
};
