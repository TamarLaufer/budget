import type { RequestHandler } from "express";

import { getAuth, getHousehold } from "../middleware/requireHousehold.js";
import * as householdService from "../services/householdService.js";
import * as invitationService from "../services/invitationService.js";
import { idParamsSchema } from "../validators/common.js";
import {
  createHouseholdSchema,
  createInvitationSchema,
  updateHouseholdSchema,
  updateMemberSchema,
} from "../validators/householdValidators.js";

export const create: RequestHandler = async (req, res) => {
  const body = createHouseholdSchema.parse(req.body);
  res.status(201).json(await householdService.createHousehold(getAuth(req), body));
};

export const getCurrent: RequestHandler = async (req, res) => {
  res.json(await householdService.getCurrent(getHousehold(req)));
};

export const updateCurrent: RequestHandler = async (req, res) => {
  const body = updateHouseholdSchema.parse(req.body);
  res.json(await householdService.rename(getHousehold(req), body.name));
};

export const listMembers: RequestHandler = async (req, res) => {
  res.json(await householdService.listMembers(getHousehold(req)));
};

export const updateMember: RequestHandler = async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const body = updateMemberSchema.parse(req.body);
  res.json(await householdService.updateMemberRole(getHousehold(req), id, body.role));
};

export const removeMember: RequestHandler = async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  await householdService.removeMember(getHousehold(req), id);
  res.status(204).end();
};

export const listInvitations: RequestHandler = async (req, res) => {
  res.json(await invitationService.listForHousehold(getHousehold(req)));
};

export const createInvitation: RequestHandler = async (req, res) => {
  const body = createInvitationSchema.parse(req.body);
  res.status(201).json(await invitationService.createInvitation(getHousehold(req), getAuth(req), body));
};

export const revokeInvitation: RequestHandler = async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  await invitationService.revoke(getHousehold(req), id);
  res.status(204).end();
};

export const listReceivedInvitations: RequestHandler = async (req, res) => {
  res.json(await invitationService.listReceived(getAuth(req)));
};

export const acceptInvitation: RequestHandler = async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  res.json(await invitationService.accept(getAuth(req), id));
};

export const declineInvitation: RequestHandler = async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  await invitationService.decline(getAuth(req), id);
  res.status(204).end();
};
