import type { Feature, Plan } from "@/mocks/types";

/**
 * Rule-based estimate. Mirrors the planned Python engine (apps/api pricing.yaml):
 * hours come from AI complexity scoring; money and time come from code, never from the model.
 */
export const BASE_HOURS = 60; // project setup, design system, deploy, QA overhead
export const HOURS_PER_WEEK = 30; // effective team throughput per engineer-week
export const TEAM_SIZE = 1.5;
export const SPREAD = 0.15; // ± range around the midpoint

export interface Estimate {
  hours: number;
  priceMin: number;
  priceMax: number;
  weeks: number;
}

export function estimate(features: Feature[], plan: Pick<Plan, "hourlyRate" | "buffer">): Estimate {
  const featureHours = features.filter((f) => f.included).reduce((sum, f) => sum + f.hours, 0);
  const hours = Math.round((featureHours + BASE_HOURS) * (1 + plan.buffer));
  const mid = hours * plan.hourlyRate;
  return {
    hours,
    priceMin: roundTo(mid * (1 - SPREAD), 100),
    priceMax: roundTo(mid * (1 + SPREAD), 100),
    weeks: Math.max(4, Math.ceil(hours / (HOURS_PER_WEEK * TEAM_SIZE))),
  };
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}
