import type {
  CategoryDto,
  CreateCategoryRequest,
  CreateHouseholdRequest,
  CreateInvitationRequest,
  CreatePaymentMethodRequest,
  CreateTransactionRequest,
  InvitableRole,
  InvitationDto,
  MeDto,
  MemberDto,
  MembershipDto,
  MonthlyBudgetDto,
  NotificationPreferencesDto,
  PaymentMethodDto,
  ReceivedInvitationDto,
  RegisterPushDeviceRequest,
  TransactionDto,
  TransactionListQuery,
  UpdateCategoryRequest,
  UpdatePaymentMethodRequest,
  UpdateTransactionRequest,
  UpsertBudgetRequest,
  CreateSubCategoryRequest,
  SubCategoryDto,
  UpdateSubCategoryRequest,
} from "../../shared/api";
import type { Period } from "../budget/period";
import { apiRequest } from "./client";

/** Typed wrappers for every backend endpoint. Components never build URLs themselves. */
export const api = {
  me: {
    get: () => apiRequest<MeDto>("GET", "/auth/me"),
    update: (displayName: string | null) => apiRequest<MeDto>("PATCH", "/auth/me", { body: { displayName } }),
  },

  notifications: {
    registerDevice: (body: RegisterPushDeviceRequest) => apiRequest<void>("PUT", "/notifications/devices", { body }),
    unregisterDevice: (token: string) => apiRequest<void>("DELETE", "/notifications/devices", { body: { token } }),
    updatePreferences: (body: NotificationPreferencesDto) =>
      apiRequest<NotificationPreferencesDto>("PUT", "/notifications/preferences", { body }),
  },

  households: {
    create: (body: CreateHouseholdRequest) => apiRequest<MembershipDto>("POST", "/households", { body }),
    rename: (name: string) => apiRequest<MembershipDto>("PATCH", "/households/current", { body: { name } }),
    members: () => apiRequest<MemberDto[]>("GET", "/households/members"),
    updateMemberRole: (memberId: string, role: InvitableRole) =>
      apiRequest<MemberDto>("PATCH", `/households/members/${memberId}`, { body: { role } }),
    removeMember: (memberId: string) => apiRequest<void>("DELETE", `/households/members/${memberId}`),
    invitations: () => apiRequest<InvitationDto[]>("GET", "/households/invitations"),
    invite: (body: CreateInvitationRequest) => apiRequest<InvitationDto>("POST", "/households/invitations", { body }),
    revokeInvitation: (id: string) => apiRequest<void>("DELETE", `/households/invitations/${id}`),
    receivedInvitations: () => apiRequest<ReceivedInvitationDto[]>("GET", "/households/invitations/received"),
    acceptInvitation: (id: string) => apiRequest<MembershipDto>("POST", `/households/invitations/${id}/accept`),
    declineInvitation: (id: string) => apiRequest<void>("POST", `/households/invitations/${id}/decline`),
  },

  categories: {
    list: () => apiRequest<CategoryDto[]>("GET", "/categories", { query: { includeInactive: true } }),
    create: (body: CreateCategoryRequest) => apiRequest<CategoryDto>("POST", "/categories", { body }),
    update: (id: string, body: UpdateCategoryRequest) => apiRequest<CategoryDto>("PATCH", `/categories/${id}`, { body }),
  },

  subCategories: {
  list: (categoryId: string) =>
    apiRequest<SubCategoryDto[]>("GET", "/subcategories", {
      // Inactive ones too: the Category Details screen manages them.
      query: { categoryId, includeInactive: true },
    }),
  create: (body: CreateSubCategoryRequest) =>
    apiRequest<SubCategoryDto>("POST", "/subcategories", { body }),
  update: (id: string, body: UpdateSubCategoryRequest) =>
    apiRequest<SubCategoryDto>("PATCH", `/subcategories/${id}`, { body }),
  },

  paymentMethods: {
    list: () => apiRequest<PaymentMethodDto[]>("GET", "/payment-methods", { query: { includeInactive: true } }),
    create: (body: CreatePaymentMethodRequest) => apiRequest<PaymentMethodDto>("POST", "/payment-methods", { body }),
    update: (id: string, body: UpdatePaymentMethodRequest) =>
      apiRequest<PaymentMethodDto>("PATCH", `/payment-methods/${id}`, { body }),
  },

  budgets: {
    list: ({ year, month }: Period) => apiRequest<MonthlyBudgetDto[]>("GET", "/budgets", { query: { year, month } }),
    upsert: (body: UpsertBudgetRequest) => apiRequest<MonthlyBudgetDto>("PUT", "/budgets", { body }),
    remove: (id: string) => apiRequest<void>("DELETE", `/budgets/${id}`),
  },

  transactions: {
    list: (query: TransactionListQuery) =>
      apiRequest<TransactionDto[]>("GET", "/transactions", { query: { ...query } }),
    create: (body: CreateTransactionRequest) => apiRequest<TransactionDto>("POST", "/transactions", { body }),
    update: (id: string, body: UpdateTransactionRequest) =>
      apiRequest<TransactionDto>("PATCH", `/transactions/${id}`, { body }),
    remove: (id: string) => apiRequest<void>("DELETE", `/transactions/${id}`),
  },
};
