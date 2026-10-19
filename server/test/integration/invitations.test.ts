import { describe, expect, it } from "vitest";

import type { InvitationDto, MeDto, MembershipDto, ReceivedInvitationDto } from "../../../shared/api.js";
import { getPrisma } from "../../src/db/prisma.js";
import { createHousehold } from "../helpers/scenarios.js";
import { createTestContext, type TestUser } from "../helpers/testApp.js";

const ctx = createTestContext();

async function invite(from: TestUser, email: string, role: "ADMIN" | "MEMBER" = "MEMBER") {
  return ctx.as(from).post("/api/households/invitations").send({ email, role });
}

async function inviteId(from: TestUser, email: string, role: "ADMIN" | "MEMBER" = "MEMBER") {
  const res = await invite(from, email, role);
  expect(res.status).toBe(201);
  return (res.body as InvitationDto).id;
}

describe("invitation flow", () => {
  it("owner invites, invitee sees and accepts, and both share the household", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    const household = await createHousehold(ctx, alice, "Shared");

    const created = await invite(alice, "  BOB@example.com ");
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ email: "bob@example.com", role: "MEMBER", status: "PENDING" });

    const received = await ctx.as(bob).get("/api/households/invitations/received");
    expect(received.status).toBe(200);
    const list = received.body as ReceivedInvitationDto[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ householdName: "Shared", invitedBy: { email: "alice@example.com" } });

    const accepted = await ctx.as(bob).post(`/api/households/invitations/${list[0]!.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ household: household.household, role: "MEMBER" } satisfies MembershipDto);

    const bobMe = (await ctx.as(bob).get("/api/auth/me")).body as MeDto;
    expect(bobMe.membership?.household.id).toBe(household.household.id);

    const sent = (await ctx.as(alice).get("/api/households/invitations")).body as InvitationDto[];
    expect(sent[0]?.status).toBe("ACCEPTED");
  });

  it("requires a verified email to list, accept or decline invitations", async () => {
    const alice = ctx.user("alice");
    const mallory = ctx.user("mallory", { email: "bob@example.com", emailVerified: false });
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, "bob@example.com");

    for (const res of [
      await ctx.as(mallory).get("/api/households/invitations/received"),
      await ctx.as(mallory).post(`/api/households/invitations/${id}/accept`),
      await ctx.as(mallory).post(`/api/households/invitations/${id}/decline`),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: "EMAIL_NOT_VERIFIED" } });
    }
    expect(await getPrisma().householdMember.count()).toBe(1);
  });

  it("cannot be accepted by a different user (reported as not found)", async () => {
    const alice = ctx.user("alice");
    const eve = ctx.user("eve");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, "bob@example.com");

    const res = await ctx.as(eve).post(`/api/households/invitations/${id}/accept`);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: "INVITATION_NOT_FOUND" } });
    expect((await ctx.as(eve).get("/api/households/invitations/received")).body).toEqual([]);
  });

  it("an expired invitation cannot be accepted", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, bob.email);
    await getPrisma().invitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await ctx.as(bob).get("/api/households/invitations/received")).body).toEqual([]);
    const res = await ctx.as(bob).post(`/api/households/invitations/${id}/accept`);
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ error: { code: "INVITATION_EXPIRED" } });
    expect((await getPrisma().invitation.findUniqueOrThrow({ where: { id } })).status).toBe("EXPIRED");
    expect(((await ctx.as(bob).get("/api/auth/me")).body as MeDto).membership).toBeNull();
  });

  it("an invitation can be used only once", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, bob.email);

    expect((await ctx.as(bob).post(`/api/households/invitations/${id}/accept`)).status).toBe(200);
    const again = await ctx.as(bob).post(`/api/households/invitations/${id}/accept`);
    expect(again.status).toBe(409);
  });

  it("concurrent accepts create exactly one membership", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, bob.email);
    await ctx.as(bob).get("/api/auth/me");

    const results = await Promise.all(
      [1, 2, 3].map(() => ctx.as(bob).post(`/api/households/invitations/${id}/accept`)),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect(await getPrisma().householdMember.count({ where: { user: { email: bob.email } } })).toBe(1);
  });

  it("prevents duplicate membership: a member of another household cannot accept", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice, "A");
    await createHousehold(ctx, bob, "B");
    const id = await inviteId(alice, bob.email);

    const res = await ctx.as(bob).post(`/api/households/invitations/${id}/accept`);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: "ALREADY_IN_HOUSEHOLD" } });
    expect((await getPrisma().invitation.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
  });

  it("declined invitations cannot be accepted later", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, bob.email);

    expect((await ctx.as(bob).post(`/api/households/invitations/${id}/decline`)).status).toBe(204);
    expect((await ctx.as(bob).post(`/api/households/invitations/${id}/accept`)).status).toBe(409);
  });

  it("revoked invitations cannot be accepted", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, bob.email);

    expect((await ctx.as(alice).delete(`/api/households/invitations/${id}`)).status).toBe(204);
    expect((await ctx.as(bob).post(`/api/households/invitations/${id}/accept`)).status).toBe(409);
  });
});

describe("invitation rules", () => {
  it("rejects a second pending invitation to the same email but allows one after expiry", async () => {
    const alice = ctx.user("alice");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, "bob@example.com");

    const duplicate = await invite(alice, "Bob@Example.com");
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({ error: { code: "INVITATION_ALREADY_PENDING" } });

    await getPrisma().invitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await invite(alice, "bob@example.com")).status).toBe(201);
  });

  it("rejects inviting existing members or yourself", async () => {
    const alice = ctx.user("alice");
    const bob = ctx.user("bob");
    await createHousehold(ctx, alice);
    const id = await inviteId(alice, bob.email);
    await ctx.as(bob).post(`/api/households/invitations/${id}/accept`);

    expect((await invite(alice, bob.email)).status).toBe(409);
    expect((await invite(alice, alice.email)).status).toBe(409);
  });

  it("MEMBER cannot invite; ADMIN can invite members but not admins", async () => {
    const owner = ctx.user("owner");
    const admin = ctx.user("admin");
    const member = ctx.user("member");
    await createHousehold(ctx, owner);
    for (const [user, role] of [[admin, "ADMIN"], [member, "MEMBER"]] as const) {
      const id = await inviteId(owner, user.email, role);
      expect((await ctx.as(user).post(`/api/households/invitations/${id}/accept`)).status).toBe(200);
    }

    const byMember = await invite(member, "x@example.com");
    expect(byMember.status).toBe(403);
    expect(byMember.body).toMatchObject({ error: { code: "INSUFFICIENT_ROLE" } });
    expect((await ctx.as(member).get("/api/households/invitations")).status).toBe(403);

    expect((await invite(admin, "y@example.com", "ADMIN")).status).toBe(403);
    expect((await invite(admin, "y@example.com", "MEMBER")).status).toBe(201);
  });

  it("validates the payload", async () => {
    const alice = ctx.user("alice");
    await createHousehold(ctx, alice);
    expect((await invite(alice, "not-an-email")).status).toBe(400);
    const ownerRole = await ctx.as(alice).post("/api/households/invitations").send({ email: "b@example.com", role: "OWNER" });
    expect(ownerRole.status).toBe(400);
    expect((await ctx.as(alice).post("/api/households/invitations/not-a-uuid/accept")).status).toBe(400);
  });

  it("a household cannot revoke another household's invitation", async () => {
    const alice = ctx.user("alice");
    const carol = ctx.user("carol");
    await createHousehold(ctx, alice, "A");
    await createHousehold(ctx, carol, "C");
    const id = await inviteId(alice, "bob@example.com");

    expect((await ctx.as(carol).delete(`/api/households/invitations/${id}`)).status).toBe(404);
    expect((await getPrisma().invitation.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
  });
});
