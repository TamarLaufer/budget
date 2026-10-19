import type { InvitableRole, MemberDto, MembershipDto } from "../../../shared/api.js";
import { getPrisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import * as categoriesRepository from "../repositories/categoriesRepository.js";
import * as householdsRepository from "../repositories/householdsRepository.js";
import * as membersRepository from "../repositories/membersRepository.js";
import type { AuthContext, HouseholdContext } from "../types/auth.js";
import { conflict, forbidden, notFound } from "../utils/errors.js";
import { toHouseholdDto, toMemberDto } from "../utils/serializers.js";
import { DEFAULT_CATEGORY_NAMES } from "./defaultCategories.js";

export const alreadyInHousehold = () =>
  conflict("ALREADY_IN_HOUSEHOLD", "You already belong to a household");

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Creates the household and its OWNER membership atomically. */
export async function createHousehold(
  auth: AuthContext,
  input: { name: string; withDefaultCategories: boolean },
): Promise<MembershipDto> {
  try {
    return await getPrisma().$transaction(async (tx) => {
      if (await membersRepository.findByUserId(auth.user.id, tx)) {
        throw alreadyInHousehold();
      }
      const household = await householdsRepository.create(
        { name: input.name, createdByUserId: auth.user.id },
        tx,
      );
      await membersRepository.create({ householdId: household.id, userId: auth.user.id, role: "OWNER" }, tx);
      if (input.withDefaultCategories) {
        await categoriesRepository.createMany(household.id, DEFAULT_CATEGORY_NAMES, tx);
      }
      return { household: toHouseholdDto(household), role: "OWNER" as const };
    });
  } catch (error) {
    // Unique(userId) on HouseholdMember: a concurrent create/accept won the race.
    if (isUniqueViolation(error)) throw alreadyInHousehold();
    throw error;
  }
}

export async function getCurrent(ctx: HouseholdContext): Promise<MembershipDto> {
  const household = await householdsRepository.findById(ctx.householdId);
  if (!household) throw notFound("HOUSEHOLD_NOT_FOUND", "Household was not found");
  return { household: toHouseholdDto(household), role: ctx.role };
}

export async function rename(ctx: HouseholdContext, name: string): Promise<MembershipDto> {
  const household = await householdsRepository.rename(ctx.householdId, name);
  return { household: toHouseholdDto(household), role: ctx.role };
}

export async function listMembers(ctx: HouseholdContext): Promise<MemberDto[]> {
  const members = await membersRepository.listByHousehold(ctx.householdId);
  return members.map(toMemberDto);
}

async function findMemberOrThrow(ctx: HouseholdContext, memberId: string) {
  const member = await membersRepository.findInHousehold(ctx.householdId, memberId);
  if (!member) throw notFound("MEMBER_NOT_FOUND", "Household member was not found");
  return member;
}

/** OWNER only (enforced by the route). The owner's own role cannot be changed. */
export async function updateMemberRole(
  ctx: HouseholdContext,
  memberId: string,
  role: InvitableRole,
): Promise<MemberDto> {
  const member = await findMemberOrThrow(ctx, memberId);
  if (member.role === "OWNER") {
    throw forbidden("CANNOT_CHANGE_OWNER", "The household owner's role cannot be changed");
  }
  return toMemberDto(await membersRepository.updateRole(member.id, role));
}

/**
 * The OWNER may remove any other member; any non-owner may remove themselves (leave).
 * The owner can never be removed, so a household always has an owner.
 */
export async function removeMember(ctx: HouseholdContext, memberId: string): Promise<void> {
  const member = await findMemberOrThrow(ctx, memberId);
  if (member.role === "OWNER") {
    throw forbidden("CANNOT_REMOVE_OWNER", "The household owner cannot be removed");
  }
  const isSelf = member.id === ctx.memberId;
  if (!isSelf && ctx.role !== "OWNER") {
    throw forbidden("INSUFFICIENT_ROLE", "Only the household owner can remove members");
  }
  await membersRepository.remove(member.id);
}
