// https://docs.expo.dev/develop/unit-testing/
const path = require("path");

// jest-expo's setup requires `expo-modules-core`, which npm may nest under `expo/` instead of
// hoisting it. Resolve it through `expo` so tests work wherever npm put it.
const expoModulesCore = path.dirname(
  require.resolve("expo-modules-core/package.json", { paths: [path.dirname(require.resolve("expo/package.json"))] }),
);

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src", "<rootDir>/shared"],
  // Expo's documented pattern, plus Redux Toolkit's ESM-only dependencies.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|immer|@reduxjs/toolkit|redux|react-redux|reselect|styled-components)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/server/"],
  moduleNameMapper: {
    "^expo-modules-core$": expoModulesCore,
    "^expo-modules-core/(.*)$": `${expoModulesCore}/$1`,
  },
};
