import type { RequestHandler } from "express";

import { getAuth } from "../middleware/requireHousehold.js";
import * as notificationService from "../services/notificationService.js";
import {
  registerDeviceSchema,
  unregisterDeviceSchema,
  updateNotificationPreferencesSchema,
} from "../validators/notificationValidators.js";

export const registerDevice: RequestHandler = async (req, res) => {
  const body = registerDeviceSchema.parse(req.body);
  await notificationService.registerDevice(getAuth(req), body);
  res.status(204).end();
};

export const unregisterDevice: RequestHandler = async (req, res) => {
  const body = unregisterDeviceSchema.parse(req.body);
  await notificationService.unregisterDevice(getAuth(req), body.token);
  res.status(204).end();
};

export const updatePreferences: RequestHandler = async (req, res) => {
  const body = updateNotificationPreferencesSchema.parse(req.body);
  res.json(await notificationService.updatePreferences(getAuth(req), body));
};
