import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { periodOf, shiftPeriod, type Period } from "../../budget/period";

/** The month the dashboard and transaction list are showing. */
const periodSlice = createSlice({
  name: "period",
  initialState: (): Period => periodOf(new Date()),
  reducers: {
    periodSelected: (_state, action: PayloadAction<Period>) => action.payload,
    periodShifted: (state, action: PayloadAction<number>) => shiftPeriod(state, action.payload),
  },
});

export const { periodSelected, periodShifted } = periodSlice.actions;
export default periodSlice.reducer;
