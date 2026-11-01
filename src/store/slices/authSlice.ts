import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { MeDto } from "../../../shared/api";
import { api } from "../../api/endpoints";
import { apiThunk, type ApiFailure, type RequestStatus } from "../shared";
import { acceptInvitation, createHousehold, leaveHousehold, renameHousehold } from "./householdSlice";

/** The parts of the Firebase user the app relies on (the SDK object itself is not serializable). */
export interface FirebaseUserInfo {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

interface AuthState {
  /** "initializing" until Firebase has restored (or not) a persisted session. */
  status: "initializing" | "signedOut" | "signedIn";
  firebaseUser: FirebaseUserInfo | null;
  /** The backend's view of the user: profile and household membership. */
  me: MeDto | null;
  meStatus: RequestStatus;
  meError: ApiFailure | null;
}

const initialState: AuthState = {
  status: "initializing",
  firebaseUser: null,
  me: null,
  meStatus: "idle",
  meError: null,
};

export const loadMe = apiThunk("auth/loadMe", () => api.me.get());
export const updateDisplayName = apiThunk("auth/updateDisplayName", (displayName: string | null) =>
  api.me.update(displayName),
);
export const updateBudgetAlerts = apiThunk("auth/updateBudgetAlerts", (budgetAlertsEnabled: boolean) =>
  api.notifications.updatePreferences({ budgetAlertsEnabled }),
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    firebaseUserChanged(state, action: PayloadAction<FirebaseUserInfo | null>) {
      state.firebaseUser = action.payload;
      state.status = action.payload ? "signedIn" : "signedOut";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMe.pending, (state) => {
        state.meStatus = "loading";
        state.meError = null;
      })
      .addCase(loadMe.fulfilled, (state, action) => {
        state.me = action.payload;
        state.meStatus = "succeeded";
      })
      .addCase(loadMe.rejected, (state, action) => {
        state.meStatus = "failed";
        state.meError = action.payload ?? null;
      })
      .addCase(updateDisplayName.fulfilled, (state, action) => {
        state.me = action.payload;
      })
      .addCase(updateBudgetAlerts.fulfilled, (state, action) => {
        if (state.me) state.me.notifications = action.payload;
      })
      // Membership changes come back from the server; mirror them without refetching /me.
      .addCase(createHousehold.fulfilled, (state, action) => {
        if (state.me) state.me.membership = action.payload;
      })
      .addCase(acceptInvitation.fulfilled, (state, action) => {
        if (state.me) state.me.membership = action.payload;
      })
      .addCase(renameHousehold.fulfilled, (state, action) => {
        if (state.me) state.me.membership = action.payload;
      })
      .addCase(leaveHousehold.fulfilled, (state) => {
        if (state.me) state.me.membership = null;
      });
  },
});

export const { firebaseUserChanged } = authSlice.actions;
export default authSlice.reducer;
