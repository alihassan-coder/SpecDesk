import type { Feature, Plan } from "@/mocks/types";

/**
 * Rule-based estimate. Mirrors the planned Python engine (apps/api pricing.yaml):
 * hours come from AI complexity scoring; money and time come from code, never from the model.
 */
export const BASE_HOURS = 60; // project setup, design system, deploy, QA overhead
export const HOURS_PER_WEEK = 30; // effective team throughput per engineer-week
export const TEAM_SIZE = 1.5;
export const SPREAD = 0.15; // ± range around the midpoint
export const PRICE_ROUND_TO = 100;
export const MIN_WEEKS = 4;

export interface Estimate {
  hours: number;
  priceMin: number;
  priceMax: number;
  weeks: number;
}

/** Every step of the estimate, for the "Why this price" view. `estimate()` is built from this. */
export interface PriceBreakdown extends Estimate {
  /** Included features, most hours first. */
  features: { id: string; name: string; hours: number }[];
  featureHours: number;
  baseHours: number;
  buffer: number;
  hourlyRate: number;
  midpoint: number;
  spread: number;
  hoursPerWeek: number;
  teamSize: number;
  minWeeks: number;
}

export function priceBreakdown(features: Feature[], plan: Pick<Plan, "hourlyRate" | "buffer">): PriceBreakdown {
  const included = features
    .filter((f) => f.included)
    .map((f) => ({ id: f.id, name: f.name, hours: f.hours }))
    .sort((a, b) => b.hours - a.hours);
  const featureHours = included.reduce((sum, f) => sum + f.hours, 0);
  const hours = Math.round((featureHours + BASE_HOURS) * (1 + plan.buffer));
  const midpoint = hours * plan.hourlyRate;
  return {
    features: included,
    featureHours,
    baseHours: BASE_HOURS,
    buffer: plan.buffer,
    hourlyRate: plan.hourlyRate,
    midpoint,
    spread: SPREAD,
    hoursPerWeek: HOURS_PER_WEEK,
    teamSize: TEAM_SIZE,
    minWeeks: MIN_WEEKS,
    hours,
    priceMin: roundTo(midpoint * (1 - SPREAD), PRICE_ROUND_TO),
    priceMax: roundTo(midpoint * (1 + SPREAD), PRICE_ROUND_TO),
    weeks: Math.max(MIN_WEEKS, Math.ceil(hours / (HOURS_PER_WEEK * TEAM_SIZE))),
  };
}

export function estimate(features: Feature[], plan: Pick<Plan, "hourlyRate" | "buffer">): Estimate {
  const { hours, priceMin, priceMax, weeks } = priceBreakdown(features, plan);
  return { hours, priceMin, priceMax, weeks };
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}
