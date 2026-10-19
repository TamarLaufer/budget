import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { emptyFormValues } from "../budget/transactionForm";
import { TransactionForm } from "../components/TransactionForm/TransactionForm";
import { strings } from "../strings/he";
import { makeCategory } from "../test-utils/fixtures";

const food = makeCategory({ id: "food", name: "מזון" });

async function renderForm(onSubmit = jest.fn(() => Promise.resolve()), submitError: string | null = null) {
  await render(
    <TransactionForm
      initialValues={emptyFormValues("2026-10-15")}
      categories={[food]}
      paymentMethods={[]}
      submitLabel={strings.SAVE}
      onSubmit={onSubmit}
      submitError={submitError}
    />,
  );
  return onSubmit;
}

describe("TransactionForm", () => {
  it("shows validation errors and does not submit invalid input", async () => {
    const onSubmit = await renderForm();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "12.345");
    await fireEvent.press(screen.getByTestId("submit-transaction"));

    expect(await screen.findByText(strings.FORM_ERRORS.AMOUNT_INVALID)).toBeTruthy();
    expect(screen.getByText(strings.FORM_ERRORS.CATEGORY_REQUIRED)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits integer agorot for a valid expense", async () => {
    const onSubmit = await renderForm();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "87.90");
    await fireEvent.press(screen.getByText("מזון"));
    await fireEvent.press(screen.getByTestId("submit-transaction"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "EXPENSE", amountAgorot: 8790, categoryId: "food", transactionDate: "2026-10-15" }),
    );
  });

  it("keeps the entered values when saving fails", async () => {
    const onSubmit = jest.fn(() => Promise.reject(new Error("offline")));
    await renderForm(onSubmit, "אין חיבור לשרת");
    await fireEvent.changeText(screen.getByTestId("amount-input"), "40");
    await fireEvent.press(screen.getByText("מזון"));
    await fireEvent.press(screen.getByTestId("submit-transaction"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByDisplayValue("40")).toBeTruthy();
    expect(screen.getByText("אין חיבור לשרת")).toBeTruthy();
  });

  it("does not require a category for income", async () => {
    const onSubmit = await renderForm();
    await fireEvent.press(screen.getByText(strings.TYPE_INCOME));
    await fireEvent.changeText(screen.getByTestId("amount-input"), "5000");
    await fireEvent.press(screen.getByTestId("submit-transaction"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "INCOME", categoryId: null })));
  });
});
