import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { readLockPreference, writeLockPreference } from "../../appLock/lockPreference";

/**
 * Biometric app lock for the signed-in Firebase user on this device.
 *
 * Every action names the user it belongs to and is ignored when that is no longer the current
 * user, so a late result (a preference read, a fingerprint prompt) can never unlock or configure
 * another account. `sessionEnded` resets the whole slice like every other slice.
 */
interface AppLockState {
  /** The user this state belongs to; null while signed out. */
  uid: string | null;
  /**
   * "checking" until the user's preference is known after a restored session; app content is not
   * rendered at all until it is resolved.
   */
  status: "checking" | "locked" | "unlocked";
  /** Whether this user turned on fingerprint unlock on this device. */
  enabled: boolean;
  /** False until the first unlock of this session: until then protected screens are never mounted. */
  hasUnlocked: boolean;
}

const initialState: AppLockState = { uid: null, status: "checking", enabled: false, hasUnlocked: false };

export const loadLockPreference = createAsyncThunk("appLock/loadPreference", async (uid: string) => ({
  uid,
  enabled: await readLockPreference(uid),
}));

export const setLockPreference = createAsyncThunk(
  "appLock/setPreference",
  async ({ uid, enabled }: { uid: string; enabled: boolean }) => {
    await writeLockPreference(uid, enabled);
    return { uid, enabled };
  },
);

const appLockSlice = createSlice({
  name: "appLock",
  initialState,
  reducers: {
    /**
     * A user became signed in. `restored` is true when Firebase restored a saved session at app
     * start (lock if enabled); false right after typing the password (already authenticated).
     */
    lockSessionStarted(_state, action: PayloadAction<{ uid: string; restored: boolean }>) {
      const { uid, restored } = action.payload;
      return { uid, status: restored ? "checking" : "unlocked", enabled: false, hasUnlocked: !restored };
    },
    /** Back from the background after the timeout. */
    appLocked(state) {
      if (state.enabled && state.status === "unlocked") state.status = "locked";
    },
    appUnlocked(state, action: PayloadAction<{ uid: string }>) {
      if (action.payload.uid !== state.uid || state.status === "checking") return;
      state.status = "unlocked";
      state.hasUnlocked = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadLockPreference.fulfilled, (state, action) => {
        if (action.payload.uid !== state.uid) return;
        state.enabled = action.payload.enabled;
        if (state.status === "checking") state.status = action.payload.enabled ? "locked" : "unlocked";
        if (state.status === "unlocked") state.hasUnlocked = true;
      })
      .addCase(loadLockPreference.rejected, (state, action) => {
        if (action.meta.arg !== state.uid) return;
        // Unknown preference: fail closed. The lock screen still offers the password and sign-out.
        state.enabled = true;
        if (state.status === "checking") state.status = "locked";
      })
      .addCase(setLockPreference.fulfilled, (state, action) => {
        if (action.payload.uid === state.uid) state.enabled = action.payload.enabled;
      });
  },
});

export const { lockSessionStarted, appLocked, appUnlocked } = appLockSlice.actions;
export default appLockSlice.reducer;
