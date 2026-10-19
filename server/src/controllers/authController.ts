import type { RequestHandler } from "express";

import { getAuth } from "../middleware/requireHousehold.js";
import * as authService from "../services/authService.js";
import { updateMeSchema } from "../validators/householdValidators.js";

export const getMe: RequestHandler = async (req, res) => {
  res.json(await authService.getMe(getAuth(req)));
};

export const updateMe: RequestHandler = async (req, res) => {
  const body = updateMeSchema.parse(req.body);
  res.json(await authService.updateMe(getAuth(req), body.displayName));
};
