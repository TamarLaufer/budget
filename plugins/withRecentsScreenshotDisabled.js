const { withMainActivity } = require("expo/config-plugins");

/**
 * Hides Spendo's content from Android's recent-apps preview (Android 13+) without blocking
 * screenshots, via Activity.setRecentsScreenshotEnabled(false). Applied at prebuild, since
 * android/ is generated. Older Android versions are handled in src/appLock/useRecentsProtection.ts.
 */

const MARKER = "setRecentsScreenshotEnabled(false)";
const CALL = `
    // Spendo: keep financial data out of the recent-apps preview (screenshots still work).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      setRecentsScreenshotEnabled(false)
    }`;

/** Inserts the call after super.onCreate(...) in a Kotlin MainActivity. Idempotent. */
function addRecentsScreenshotDisabled(contents) {
  if (contents.includes(MARKER)) return contents;
  const superOnCreate = /super\.onCreate\([^)]*\);?/;
  if (!superOnCreate.test(contents)) {
    throw new Error("withRecentsScreenshotDisabled: super.onCreate(...) not found in MainActivity");
  }
  let result = contents.replace(superOnCreate, (match) => `${match}${CALL}`);
  if (!/^import android\.os\.Build$/m.test(result)) {
    result = result.replace(/^(package .+)$/m, "$1\n\nimport android.os.Build");
  }
  return result;
}

function withRecentsScreenshotDisabled(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") {
      throw new Error("withRecentsScreenshotDisabled: only a Kotlin MainActivity is supported");
    }
    mod.modResults.contents = addRecentsScreenshotDisabled(mod.modResults.contents);
    return mod;
  });
}

module.exports = withRecentsScreenshotDisabled;
module.exports.addRecentsScreenshotDisabled = addRecentsScreenshotDisabled;
