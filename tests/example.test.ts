import { it, expect, describe } from "vitest";

describe("Dificult numbers", () => {
  it(
    "odd numbers that don't have the letter 'e' in their spelling",
    () => {
      expect(
        computeNumbers(
          {
            spellingContains: ["e"],
            isOdd: true,
          },
          3
        )
      ).length.to.be.greaterThan(0);
    },
    { skip: !!process.env.CI }
  );
});

/**
 * Given a condition, compute the numbers that satisfy the condition
 */
function computeNumbers(
  condition: {
    spellingContains: string[];
    isOdd: boolean;
  },
  max: number
) {
  const SPELLINGS = [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
  ];

  const TENTHS = [
    "",
    "ten",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  function getSpelling(number: number) {
    if (number < 1) {
      throw new Error("Number out of range");
    }
    if (SPELLINGS[number - 1]) {
      return SPELLINGS[number - 1];
    }
    const tenthBase = Math.floor(number / 10);
    const unit = number % 10;
    return `${TENTHS[tenthBase]}${unit > 0 ? getSpelling(unit) : ""}`;
  }

  function isOdd(number: number) {
    return number % 2 !== 0;
  }

  const numbers: number[] = [];

  // for now try 1k 😈
  for (let i = 1; i <= 1000; i++) {
    if (condition.isOdd && !isOdd(i)) {
      continue;
    }
    if (
      condition.spellingContains.every(
        (letter) => !getSpelling(i).includes(letter)
      )
    ) {
      numbers.push(i);
    }
  }

  return numbers;
}
