import { combineReducers, configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import { sessionEnded } from "./shared";
import authReducer from "./slices/authSlice";
import budgetsReducer from "./slices/budgetsSlice";
import { categoriesReducer, paymentMethodsReducer } from "./slices/catalogSlices";
import householdReducer from "./slices/householdSlice";
import periodReducer from "./slices/periodSlice";
import transactionsReducer from "./slices/transactionsSlice";

const appReducer = combineReducers({
  auth: authReducer,
  household: householdReducer,
  transactions: transactionsReducer,
  categories: categoriesReducer,
  budgets: budgetsReducer,
  paymentMethods: paymentMethodsReducer,
  period: periodReducer,
});

export type RootState = ReturnType<typeof appReducer>;

/** On sign-out every slice is reset, so the next account never sees the previous one's data. */
export function rootReducer(state: Partial<RootState> | undefined, action: UnknownAction): RootState {
  if (sessionEnded.match(action)) {
    const fresh = appReducer(undefined, action);
    return { ...fresh, auth: { ...fresh.auth, status: "signedOut" } };
  }
  return appReducer(state, action);
}

export function createStore(preloadedState?: Partial<RootState>) {
  return configureStore({ reducer: rootReducer, preloadedState });
}

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
