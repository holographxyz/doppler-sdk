/**
 * Computes the graduation percentage based on balance and threshold
 * @param graduationBalance - Current graduation balance (accumulated quote tokens from swaps)
 * @param graduationThreshold - Target graduation threshold (theoretical max from liquidity)
 * @returns Percentage as a number with 2 decimal places (0.00 to 100.00+)
 */
export const computeGraduationPercentage = (
  graduationBalance: bigint,
  graduationThreshold: bigint
): number => {
  // Handle division by zero cases
  if (graduationThreshold === 0n) return 0;

  // Calculate percentage with 2 decimal places
  // Multiply by 10000 to get 2 decimal places, then divide by 100 for a final result
  return Number((graduationBalance * 10000n) / graduationThreshold) / 100;
};
