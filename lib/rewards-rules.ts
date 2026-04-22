export type Redemption =
  | { kind: "none" }
  | { kind: "flat"; points: number }
  | { kind: "addons" }
  | { kind: "tier1" }
  | { kind: "tier2" };

export const REWARDS_RULES = {
  addons: { points: 60, minCart: 0, creditAmount: 2 },
  tier1: { points: 700, minCart: 25, percent: 0.15 },
  tier2: { points: 1400, minCart: 40, percent: 0.40 }
} as const;

export type ResolvedRedemption = {
  pointsCost: number;
  discount: number;
};

export function resolveRedemption(
  redemption: Redemption,
  subtotal: number,
  baseSubtotal: number
): ResolvedRedemption {
  switch (redemption.kind) {
    case "none":
      return { pointsCost: 0, discount: 0 };

    case "flat": {
      if (!Number.isInteger(redemption.points) || redemption.points < 0) {
        throw new Error("Flat redemption points must be a non-negative integer.");
      }
      if (redemption.points % 100 !== 0) {
        throw new Error("Flat redemption points must be a multiple of 100.");
      }
      const maxPoints = Math.floor(subtotal) * 100;
      if (redemption.points > maxPoints) {
        throw new Error("Flat redemption exceeds order subtotal.");
      }
      return {
        pointsCost: redemption.points,
        discount: redemption.points / 100
      };
    }

    case "addons": {
      const addonCost = Math.max(0, subtotal - baseSubtotal);
      return {
        pointsCost: REWARDS_RULES.addons.points,
        discount: Math.min(REWARDS_RULES.addons.creditAmount, addonCost)
      };
    }

    case "tier1": {
      if (subtotal < REWARDS_RULES.tier1.minCart) {
        throw new Error(`Tier 1 redemption requires a cart of at least $${REWARDS_RULES.tier1.minCart}.`);
      }
      return {
        pointsCost: REWARDS_RULES.tier1.points,
        discount: subtotal * REWARDS_RULES.tier1.percent
      };
    }

    case "tier2": {
      if (subtotal < REWARDS_RULES.tier2.minCart) {
        throw new Error(`Tier 2 redemption requires a cart of at least $${REWARDS_RULES.tier2.minCart}.`);
      }
      return {
        pointsCost: REWARDS_RULES.tier2.points,
        discount: subtotal * REWARDS_RULES.tier2.percent
      };
    }
  }
}
