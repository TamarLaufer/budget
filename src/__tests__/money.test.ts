import { MAX_AMOUNT_AGOROT } from "../../shared/limits";
import { agorotToInput, formatAgorot, parseShekelInput } from "../budget/money";

describe("parseShekelInput", () => {
  it.each([
    ["87.90", 8790],
    ["87.9", 8790],
    ["87,90", 8790],
    ["87", 8700],
    ["0.29", 29],
    ["0.01", 1],
    ["1,250", 125_000],
    ["1,250.50", 125_050],
    ["1,234,567", 123_456_700],
    [" ₪ 40 ", 4000],
    ["0", 0],
  ])("parses %p as %p agorot", (input, expected) => {
    expect(parseShekelInput(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.005", "1.2.3", "1e3", "12,34,5", ".5", "5."])("rejects %p", (input) => {
    expect(parseShekelInput(input)).toBeNull();
  });

  it("rejects amounts above the server limit", () => {
    expect(parseShekelInput(String(MAX_AMOUNT_AGOROT / 100))).toBe(MAX_AMOUNT_AGOROT);
    expect(parseShekelInput(String(MAX_AMOUNT_AGOROT / 100 + 1))).toBeNull();
  });

  it("never introduces floating-point error", () => {
    // 1.15 * 100 === 114.99999999999999 in floating point; text parsing avoids it.
    expect(parseShekelInput("1.15")).toBe(115);
    expect(parseShekelInput("4.35")).toBe(435);
  });
});

describe("agorotToInput", () => {
  it("round-trips through parseShekelInput", () => {
    for (const amount of [1, 29, 100, 8790, 125_050, 99_999_999]) {
      expect(parseShekelInput(agorotToInput(amount))).toBe(amount);
    }
  });

  it("omits agorot when zero", () => {
    expect(agorotToInput(5000)).toBe("50");
    expect(agorotToInput(8790)).toBe("87.90");
    expect(agorotToInput(5)).toBe("0.05");
  });
});

describe("formatAgorot", () => {
  it("formats with thousands separators and the shekel sign", () => {
    expect(formatAgorot(240_000)).toBe("2,400 ₪");
    expect(formatAgorot(8790)).toBe("87.90 ₪");
    expect(formatAgorot(-15_000)).toBe("-150 ₪");
    expect(formatAgorot(0)).toBe("0 ₪");
  });
});
