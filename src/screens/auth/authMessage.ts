import { authErrorKey } from "@/auth/session";
import { strings } from "@/strings/he";

export const authMessage = (error: unknown) => strings.AUTH_ERRORS[authErrorKey(error)] ?? strings.AUTH_ERRORS.UNKNOWN ?? "";
