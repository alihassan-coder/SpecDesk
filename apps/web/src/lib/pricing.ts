import type { Feature, Plan } from "@/mocks/types";

/**
 * Rule-based estimate. Mirrors the planned Python engine (apps/api pricing.yaml):
 * hours come from AI complexity scoring; money and time come from code, never from the model.
 */
export const BASE_HOURS = 24; // project setup, deploy, QA overhead ("medium" default)
export const HOURS_PER_WEEK = 30; // effective team throughput per engineer-week
export const HOURS_PER_DAY = 6; // focused hours per engineer-day, for jobs counted in days
export const TEAM_SIZE = 1.5;
export const SPREAD = 0.15; // ± range around the midpoint
export const PRICE_ROUND_TO = 100;
export const MIN_WEEKS = 1;

export type ProjectSize = "tiny" | "small" | "medium" | "large";

/** Per-size base hours, buffer and team — mirrors `sizes` in apps/api/pricing.yaml. */
export const SIZES: Record<ProjectSize, { label: string; baseHours: number; buffer: number; teamSize: number }> = {
  tiny: { label: "Basic", baseHours: 2, buffer: 0.1, teamSize: 1 },
  small: { label: "Small", baseHours: 12, buffer: 0.15, teamSize: 1 },
  medium: { label: "Intermediate", baseHours: 24, buffer: 0.15, teamSize: 1.5 },
  large: { label: "Big", baseHours: 40, buffer: 0.2, teamSize: 2 },
};

export interface Estimate {
  hours: number;
  priceMin: number;
  priceMax: number;
  weeks: number;
  /** Working days — shown instead of weeks for jobs of a week or less. */
  days: number;
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

type PricedPlan = Pick<Plan, "hourlyRate" | "buffer"> & { size?: ProjectSize | string };

export function priceBreakdown(features: Feature[], plan: PricedPlan): PriceBreakdown {
  const tier = plan.size && plan.size in SIZES ? SIZES[plan.size as ProjectSize] : null;
  const baseHours = tier?.baseHours ?? BASE_HOURS;
  const teamSize = tier?.teamSize ?? TEAM_SIZE;
  const included = features
    .filter((f) => f.included)
    .map((f) => ({ id: f.id, name: f.name, hours: f.hours }))
    .sort((a, b) => b.hours - a.hours);
  const featureHours = included.reduce((sum, f) => sum + f.hours, 0);
  const hours = Math.round((featureHours + baseHours) * (1 + plan.buffer));
  const midpoint = hours * plan.hourlyRate;
  return {
    features: included,
    featureHours,
    baseHours,
    buffer: plan.buffer,
    hourlyRate: plan.hourlyRate,
    midpoint,
    spread: SPREAD,
    hoursPerWeek: HOURS_PER_WEEK,
    teamSize,
    minWeeks: MIN_WEEKS,
    hours,
    priceMin: roundTo(midpoint * (1 - SPREAD), PRICE_ROUND_TO),
    priceMax: roundTo(midpoint * (1 + SPREAD), PRICE_ROUND_TO),
    weeks: Math.max(MIN_WEEKS, Math.ceil(hours / (HOURS_PER_WEEK * teamSize))),
    days: Math.max(1, Math.ceil(hours / (HOURS_PER_DAY * teamSize))),
  };
}

/** "4 days" for a week or less of work, otherwise "6 weeks" — same rule as the API. */
export function formatDuration({ weeks, days }: { weeks: number; days?: number }): string {
  if (days !== undefined && days <= 5) return days === 1 ? "1 day" : `${days} days`;
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

export function estimate(features: Feature[], plan: PricedPlan): Estimate {
  const { hours, priceMin, priceMax, weeks, days } = priceBreakdown(features, plan);
  return { hours, priceMin, priceMax, weeks, days };
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}
