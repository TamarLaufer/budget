import type {
  InvitableRole,
  InvitationDto,
  MembershipDto,
  ReceivedInvitationDto,
} from "../../../shared/api.js";
import { getPrisma } from "../db/prisma.js";
import * as invitationsRepository from "../repositories/invitationsRepository.js";
import * as membersRepository from "../repositories/membersRepository.js";
import type { AuthContext, HouseholdContext } from "../types/auth.js";
import { conflict, forbidden, gone, notFound } from "../utils/errors.js";
import { toHouseholdDto, toInvitationDto, toReceivedInvitationDto } from "../utils/serializers.js";
import { alreadyInHousehold, isUniqueViolation } from "./householdService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITATION_TTL_DAYS = 7;

const invitationNotFound = () => notFound("INVITATION_NOT_FOUND", "Invitation was not found");

/**
 * SECURITY: invitations are matched to recipients by email, and Firebase lets anyone create an
 * email/password account for any address. Only a *verified* email proves the user owns the
 * address the invitation was sent to, so every recipient action requires it.
 */
function requireVerifiedEmail(auth: AuthContext): void {
  if (!auth.emailVerified) {
    throw forbidden("EMAIL_NOT_VERIFIED", "Verify your email address to use invitations");
  }
}

export async function createInvitation(
  ctx: HouseholdContext,
  auth: AuthContext,
  input: { email: string; role: InvitableRole },
): Promise<InvitationDto> {
  if (input.role === "ADMIN" && ctx.role !== "OWNER") {
    throw forbidden("INSUFFICIENT_ROLE", "Only the household owner can invite admins");
  }
  if (input.email === auth.user.email) {
    throw conflict("ALREADY_MEMBER", "You are already a member of this household");
  }
  if (await membersRepository.existsInHouseholdByEmail(ctx.householdId, input.email)) {
    throw conflict("ALREADY_MEMBER", "This person is already a member of the household");
  }

  const now = new Date();
  // Expired invitations must not block a fresh one (partial unique index on PENDING).
  await invitationsRepository.expireStalePending(ctx.householdId, input.email, now);
  try {
    const invitation = await invitationsRepository.create({
      householdId: ctx.householdId,
      email: input.email,
      role: input.role,
      invitedByUserId: auth.user.id,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
    });
    return toInvitationDto(invitation, now);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("INVITATION_ALREADY_PENDING", "An invitation to this email is already pending");
    }
    throw error;
  }
}

export async function listForHousehold(ctx: HouseholdContext): Promise<InvitationDto[]> {
  const now = new Date();
  const invitations = await invitationsRepository.listForHousehold(ctx.householdId);
  return invitations.map((i) => toInvitationDto(i, now));
}

export async function revoke(ctx: HouseholdContext, invitationId: string): Promise<void> {
  const invitation = await invitationsRepository.findInHousehold(ctx.householdId, invitationId);
  if (!invitation) throw invitationNotFound();
  if (!(await invitationsRepository.transitionFromPending(invitation.id, "REVOKED"))) {
    throw conflict("INVITATION_NOT_PENDING", "The invitation is no longer pending");
  }
}

export async function listReceived(auth: AuthContext): Promise<ReceivedInvitationDto[]> {
  requireVerifiedEmail(auth);
  const invitations = await invitationsRepository.listPendingForEmail(auth.user.email, new Date());
  return invitations.map(toReceivedInvitationDto);
}

/** Loads an invitation addressed to the caller that can still be answered. */
async function findAnswerable(auth: AuthContext, invitationId: string) {
  requireVerifiedEmail(auth);
  // Invitations addressed to someone else are reported as not found (no existence leak).
  const invitation = await invitationsRepository.findForRecipient(invitationId, auth.user.email);
  if (!invitation) throw invitationNotFound();
  if (invitation.status !== "PENDING") {
    throw conflict("INVITATION_NOT_PENDING", "The invitation is no longer pending");
  }
  if (invitation.expiresAt <= new Date()) {
    await invitationsRepository.transitionFromPending(invitation.id, "EXPIRED");
    throw gone("INVITATION_EXPIRED", "The invitation has expired");
  }
  return invitation;
}

/**
 * Joins the household atomically: the membership row and the ACCEPTED status are written in one
 * transaction. Unique(userId) on HouseholdMember rules out duplicate/second memberships even under
 * concurrent requests, and the conditional status update ensures an invitation is used only once.
 */
export async function accept(auth: AuthContext, invitationId: string): Promise<MembershipDto> {
  const invitation = await findAnswerable(auth, invitationId);
  try {
    return await getPrisma().$transaction(async (tx) => {
      if (await membersRepository.findByUserId(auth.user.id, tx)) {
        throw alreadyInHousehold();
      }
      const member = await membersRepository.create(
        { householdId: invitation.householdId, userId: auth.user.id, role: invitation.role },
        tx,
      );
      if (!(await invitationsRepository.transitionFromPending(invitation.id, "ACCEPTED", tx))) {
        throw conflict("INVITATION_NOT_PENDING", "The invitation is no longer pending");
      }
      return { household: toHouseholdDto(member.household), role: member.role };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw alreadyInHousehold();
    throw error;
  }
}

export async function decline(auth: AuthContext, invitationId: string): Promise<void> {
  const invitation = await findAnswerable(auth, invitationId);
  if (!(await invitationsRepository.transitionFromPending(invitation.id, "DECLINED"))) {
    throw conflict("INVITATION_NOT_PENDING", "The invitation is no longer pending");
  }
}
