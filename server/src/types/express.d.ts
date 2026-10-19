import type { AuthContext, HouseholdContext } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. */
      auth?: AuthContext;
      /** Set by `requireHousehold`; always derived from the authenticated user's DB membership. */
      household?: HouseholdContext;
    }
  }
}

export {};
