import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic additions on top of app.json.
 *
 * Android 9+ blocks plain-HTTP requests. They are allowed only when the build's API URL is
 * itself http:// (testing against a backend on your LAN). Production builds must use https://.
 */

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDev = process.env.APP_VARIANT === "development";
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  // FCM config for push notifications, never committed. On EAS: the GOOGLE_SERVICES_JSON file
  // environment variable. Locally: GOOGLE_SERVICES_JSON=./google-services.json in .env.
  // Without it the app still builds; push registration then fails and Settings says so.
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

  return {
    ...config,
    name: isDev ? "Spendo Dev" : "Spendo",
    slug: config.slug ?? "spendo",

    android: {
      ...config.android,
      package: isDev
        ? "com.tamarlaufer.spendo.dev"
        : "com.tamarlaufer.spendo",
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },

    ios: {
      ...config.ios,
      bundleIdentifier: isDev
        ? "com.tamarlaufer.spendo.dev"
        : "com.tamarlaufer.spendo",
    },

    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: isDev && apiUrl.startsWith("http://"),
            cmakeVersion: "3.31.6",
          },
        },
      ],
    ],
  };
};