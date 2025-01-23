import { it, expect, describe } from "vitest";

function appendToArray(array: number[], ...values: number[]) {
  array.push(...values);
  return values;
}

describe("Fixable tests", () => {
  it("should be fixable", { skip: !!process.env.CI }, async () => {
    const array = [];
    const STUPIDLY_LARGE_NUMBER = 1000 ** 100;
    const values = Array.from({ length: STUPIDLY_LARGE_NUMBER }, (_, i) => i);
    appendToArray(array, ...values);
    expect(array).toHaveLength(STUPIDLY_LARGE_NUMBER + 3);
  });
});
