import { z } from "zod";

import { MAX_NAME_LENGTH } from "../../../shared/limits.js";
import { emailSchema, nameSchema } from "./common.js";

export const createHouseholdSchema = z.strictObject({
  name: nameSchema,
  withDefaultCategories: z.boolean().optional().default(false),
});

export const updateHouseholdSchema = z.strictObject({ name: nameSchema });

export const updateMeSchema = z.strictObject({
  displayName: z
    .string()
    .trim()
    .max(MAX_NAME_LENGTH)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

const invitableRoleSchema = z.enum(["ADMIN", "MEMBER"]);

export const createInvitationSchema = z.strictObject({
  email: emailSchema,
  role: invitableRoleSchema,
});

export const updateMemberSchema = z.strictObject({ role: invitableRoleSchema });
