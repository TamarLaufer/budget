import { expect } from "vitest";

import type { CategoryDto, InvitableRole, MembershipDto } from "../../../shared/api.js";
import type { TestContext, TestUser } from "./testApp.js";

/** Creates a household owned by `owner` through the public API. */
export async function createHousehold(ctx: TestContext, owner: TestUser, name = "Home"): Promise<MembershipDto> {
  const res = await ctx.as(owner).post("/api/households").send({ name });
  expect(res.status).toBe(201);
  return res.body as MembershipDto;
}

export async function createCategory(ctx: TestContext, user: TestUser, name: string): Promise<CategoryDto> {
  const res = await ctx.as(user).post("/api/categories").send({ name });
  expect(res.status).toBe(201);
  return res.body as CategoryDto;
}

/** Invites `invitee` into `inviter`'s household and accepts it. */
export async function addMember(
  ctx: TestContext,
  inviter: TestUser,
  invitee: TestUser,
  role: InvitableRole = "MEMBER",
): Promise<void> {
  const invite = await ctx.as(inviter).post("/api/households/invitations").send({ email: invitee.email, role });
  expect(invite.status).toBe(201);
  const accept = await ctx.as(invitee).post(`/api/households/invitations/${(invite.body as { id: string }).id}/accept`);
  expect(accept.status).toBe(200);
}
