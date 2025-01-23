import { it, expect, describe } from "vitest";

describe("Slow tests", () => {
  it("should be slow", { skip: !!process.env.CI }, async () => {
    const startTime = performance.now();
    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await wait(3000);
    const endTime = performance.now();
    const duration = endTime - startTime;
    expect(duration).toBeGreaterThan(2000);
  });
});
