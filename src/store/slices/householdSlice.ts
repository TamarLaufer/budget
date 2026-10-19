import { createSlice } from "@reduxjs/toolkit";

import type {
  CreateHouseholdRequest,
  InvitableRole,
  InvitationDto,
  MemberDto,
  ReceivedInvitationDto,
} from "../../../shared/api";
import { api } from "../../api/endpoints";
import { apiThunk, loadFailed, loadPending, loadSucceeded, householdChanged, idleLoad, type LoadState } from "../shared";

interface HouseholdState {
  members: MemberDto[];
  membersLoad: LoadState;
  /** Invitations sent by this household (visible to OWNER/ADMIN). */
  invitations: InvitationDto[];
  invitationsLoad: LoadState;
  /** Pending invitations addressed to the signed-in user (onboarding). */
  received: ReceivedInvitationDto[];
  receivedLoad: LoadState;
}

const initialState: HouseholdState = {
  members: [],
  membersLoad: idleLoad,
  invitations: [],
  invitationsLoad: idleLoad,
  received: [],
  receivedLoad: idleLoad,
};

export const createHousehold = apiThunk("household/create", (body: CreateHouseholdRequest) =>
  api.households.create(body),
);
export const renameHousehold = apiThunk("household/rename", (name: string) => api.households.rename(name));
export const fetchMembers = apiThunk("household/fetchMembers", () => api.households.members());
export const updateMemberRole = apiThunk(
  "household/updateMemberRole",
  ({ memberId, role }: { memberId: string; role: InvitableRole }) => api.households.updateMemberRole(memberId, role),
);
export const removeMember = apiThunk("household/removeMember", (memberId: string) =>
  api.households.removeMember(memberId),
);
export const leaveHousehold = apiThunk("household/leave", (ownMemberId: string) =>
  api.households.removeMember(ownMemberId),
);
export const fetchInvitations = apiThunk("household/fetchInvitations", () => api.households.invitations());
export const sendInvitation = apiThunk(
  "household/sendInvitation",
  (body: { email: string; role: InvitableRole }) => api.households.invite(body),
);
export const revokeInvitation = apiThunk("household/revokeInvitation", (id: string) =>
  api.households.revokeInvitation(id),
);
export const fetchReceivedInvitations = apiThunk("household/fetchReceived", () =>
  api.households.receivedInvitations(),
);
export const acceptInvitation = apiThunk("household/acceptInvitation", (id: string) =>
  api.households.acceptInvitation(id),
);
export const declineInvitation = apiThunk("household/declineInvitation", (id: string) =>
  api.households.declineInvitation(id),
);

const householdSlice = createSlice({
  name: "household",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(householdChanged, () => initialState)

      .addCase(fetchMembers.pending, (state) => {
        state.membersLoad = loadPending(state.membersLoad);
      })
      .addCase(fetchMembers.fulfilled, (state, action) => {
        state.members = action.payload;
        state.membersLoad = loadSucceeded;
      })
      .addCase(fetchMembers.rejected, (state, action) => {
        state.membersLoad = loadFailed(state.membersLoad, action.payload);
      })
      .addCase(updateMemberRole.fulfilled, (state, action) => {
        state.members = state.members.map((m) => (m.id === action.payload.id ? action.payload : m));
      })
      .addCase(removeMember.fulfilled, (state, action) => {
        state.members = state.members.filter((m) => m.id !== action.meta.arg);
      })

      .addCase(fetchInvitations.pending, (state) => {
        state.invitationsLoad = loadPending(state.invitationsLoad);
      })
      .addCase(fetchInvitations.fulfilled, (state, action) => {
        state.invitations = action.payload;
        state.invitationsLoad = loadSucceeded;
      })
      .addCase(fetchInvitations.rejected, (state, action) => {
        state.invitationsLoad = loadFailed(state.invitationsLoad, action.payload);
      })
      .addCase(sendInvitation.fulfilled, (state, action) => {
        state.invitations.unshift(action.payload);
      })
      .addCase(revokeInvitation.fulfilled, (state, action) => {
        const invitation = state.invitations.find((i) => i.id === action.meta.arg);
        if (invitation) invitation.status = "REVOKED";
      })

      .addCase(fetchReceivedInvitations.pending, (state) => {
        state.receivedLoad = loadPending(state.receivedLoad);
      })
      .addCase(fetchReceivedInvitations.fulfilled, (state, action) => {
        state.received = action.payload;
        state.receivedLoad = loadSucceeded;
      })
      .addCase(fetchReceivedInvitations.rejected, (state, action) => {
        state.receivedLoad = loadFailed(state.receivedLoad, action.payload);
      })
      .addCase(declineInvitation.fulfilled, (state, action) => {
        state.received = state.received.filter((i) => i.id !== action.meta.arg);
      })
      .addCase(acceptInvitation.fulfilled, (state, action) => {
        state.received = state.received.filter((i) => i.id !== action.meta.arg);
      });
  },
});

export default householdSlice.reducer;
