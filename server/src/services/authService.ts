import type { MeDto } from "../../../shared/api.js";
import * as membersRepository from "../repositories/membersRepository.js";
import * as usersRepository from "../repositories/usersRepository.js";
import type { AuthContext } from "../types/auth.js";
import { toHouseholdDto, toUserDto } from "../utils/serializers.js";

export async function getMe(auth: AuthContext): Promise<MeDto> {
  const [membership, user] = await Promise.all([
    membersRepository.findByUserIdWithHousehold(auth.user.id),
    usersRepository.findById(auth.user.id),
  ]);
  return {
    user: toUserDto(auth.user),
    membership: membership
      ? { household: toHouseholdDto(membership.household), role: membership.role }
      : null,
    notifications: { budgetAlertsEnabled: user?.budgetAlertsEnabled ?? false },
  };
}

export async function updateMe(auth: AuthContext, displayName: string | null): Promise<MeDto> {
  const user = await usersRepository.updateDisplayName(auth.user.id, displayName);
  return getMe({ ...auth, user: toUserDto(user) });
}
