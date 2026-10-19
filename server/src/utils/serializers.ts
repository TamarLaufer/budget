/**
 * Maps database rows to API DTOs. Only fields listed here leave the server, so internal columns
 * (firebaseUid, householdId, …) are never exposed by accident.
 */
import type {
  CategoryDto,
  HouseholdDto,
  InvitableRole,
  InvitationDto,
  InvitationStatus,
  MemberDto,
  MonthlyBudgetDto,
  PaymentMethodDto,
  ReceivedInvitationDto,
  TransactionDto,
  UserDto,
} from "../../../shared/api.js";
import type {
  Category,
  Household,
  HouseholdMember,
  Invitation,
  MonthlyBudget,
  PaymentMethod,
  Transaction,
} from "../generated/prisma/client.js";
import { dateToDateOnly } from "./dates.js";

type UserRow = { id: string; email: string; displayName: string | null };

export const toUserDto = (u: UserRow): UserDto => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
});

export const toHouseholdDto = (h: Household): HouseholdDto => ({
  id: h.id,
  name: h.name,
  createdAt: h.createdAt.toISOString(),
});

export const toMemberDto = (m: HouseholdMember & { user: UserRow }): MemberDto => ({
  id: m.id,
  role: m.role,
  joinedAt: m.createdAt.toISOString(),
  user: toUserDto(m.user),
});

// The database CHECK constraint guarantees invitations never carry the OWNER role.
const invitableRole = (role: Invitation["role"]): InvitableRole => (role === "OWNER" ? "MEMBER" : role);

/** A PENDING invitation past its expiry is reported as EXPIRED even before it is updated. */
function effectiveStatus(i: Invitation, now: Date): InvitationStatus {
  return i.status === "PENDING" && i.expiresAt <= now ? "EXPIRED" : i.status;
}

export const toInvitationDto = (i: Invitation & { invitedBy: UserRow }, now = new Date()): InvitationDto => ({
  id: i.id,
  email: i.email,
  role: invitableRole(i.role),
  status: effectiveStatus(i, now),
  expiresAt: i.expiresAt.toISOString(),
  createdAt: i.createdAt.toISOString(),
  invitedBy: toUserDto(i.invitedBy),
});

export const toReceivedInvitationDto = (
  i: Invitation & { invitedBy: UserRow; household: { name: string } },
): ReceivedInvitationDto => ({
  id: i.id,
  role: invitableRole(i.role),
  expiresAt: i.expiresAt.toISOString(),
  householdName: i.household.name,
  invitedBy: toUserDto(i.invitedBy),
});

export const toCategoryDto = (c: Category): CategoryDto => ({
  id: c.id,
  name: c.name,
  isActive: c.isActive,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

export const toPaymentMethodDto = (p: PaymentMethod): PaymentMethodDto => ({
  id: p.id,
  name: p.name,
  isActive: p.isActive,
});

export const toBudgetDto = (b: MonthlyBudget): MonthlyBudgetDto => ({
  id: b.id,
  categoryId: b.categoryId,
  year: b.year,
  month: b.month,
  amountAgorot: b.amountAgorot,
});

export const toTransactionDto = (t: Transaction & { createdBy: UserRow }): TransactionDto => ({
  id: t.id,
  type: t.type,
  amountAgorot: t.amountAgorot,
  categoryId: t.categoryId,
  description: t.description,
  transactionDate: dateToDateOnly(t.transactionDate),
  paymentMethodId: t.paymentMethodId,
  incomeSource: t.incomeSource,
  createdBy: toUserDto(t.createdBy),
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
