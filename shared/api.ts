/**
 * REST API contract shared by the mobile app and the server.
 * Type-only: nothing here exists at runtime, so it is safe to import from both packages.
 *
 * Money is always integer agorot (₪87.90 = 8790). Calendar dates are "YYYY-MM-DD" strings,
 * timestamps are ISO-8601 strings.
 */

export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type InvitableRole = Exclude<Role, "OWNER">;
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
export type TransactionType = "EXPENSE" | "INCOME";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string | null;
}

export interface HouseholdDto {
  id: string;
  name: string;
  createdAt: string;
}

export interface MembershipDto {
  household: HouseholdDto;
  role: Role;
}

export interface MeDto {
  user: UserDto;
  /** null until the user creates a household or accepts an invitation. */
  membership: MembershipDto | null;
  notifications: NotificationPreferencesDto;
}

/** The signed-in user's own notification settings (never exposed for other members). */
export interface NotificationPreferencesDto {
  budgetAlertsEnabled: boolean;
}

/** `data` attached to a budget alert push notification. Contains no amounts or descriptions. */
export interface BudgetAlertPushData {
  type: "budget-alert";
  year: number;
  /** 1-12 */
  month: number;
  categoryId: string;
}

export interface MemberDto {
  id: string;
  role: Role;
  joinedAt: string;
  user: UserDto;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: InvitableRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: UserDto;
}

/** An invitation as seen by its recipient, who is not yet a member and only learns the household name. */
export interface ReceivedInvitationDto {
  id: string;
  role: InvitableRole;
  expiresAt: string;
  householdName: string;
  invitedBy: UserDto;
}

export interface CategoryDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodDto {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MonthlyBudgetDto {
  id: string;
  categoryId: string;
  year: number;
  /** 1-12 */
  month: number;
  amountAgorot: number;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  amountAgorot: number;
  categoryId: string | null;
  description: string | null;
  /** "YYYY-MM-DD" */
  transactionDate: string;
  paymentMethodId: string | null;
  incomeSource: string | null;
  createdBy: UserDto;
  createdAt: string;
  updatedAt: string;
}

// ---- Request bodies ----

export interface CreateHouseholdRequest {
  name: string;
  /** Adds a starter set of categories to the new household. */
  withDefaultCategories?: boolean;
}

export interface UpdateMeRequest {
  displayName: string | null;
}

export interface RegisterPushDeviceRequest {
  /** Expo push token, "ExponentPushToken[...]". */
  token: string;
  platform: "android" | "ios";
}

export interface UnregisterPushDeviceRequest {
  token: string;
}

export type UpdateNotificationPreferencesRequest = NotificationPreferencesDto;

export interface CreateInvitationRequest {
  email: string;
  role: InvitableRole;
}

export interface UpdateMemberRequest {
  role: InvitableRole;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  isActive?: boolean;
}

export interface CreatePaymentMethodRequest {
  name: string;
}

export interface UpdatePaymentMethodRequest {
  name?: string;
  isActive?: boolean;
}

export interface UpsertBudgetRequest {
  categoryId: string;
  year: number;
  month: number;
  amountAgorot: number;
}

export interface UpdateBudgetRequest {
  amountAgorot: number;
}

export interface CreateTransactionRequest {
  type: TransactionType;
  amountAgorot: number;
  categoryId?: string | null;
  description?: string | null;
  transactionDate: string;
  paymentMethodId?: string | null;
  incomeSource?: string | null;
}

export type UpdateTransactionRequest = Partial<CreateTransactionRequest>;

export interface TransactionListQuery {
  year?: number;
  month?: number;
  categoryId?: string;
  type?: TransactionType;
  q?: string;
}