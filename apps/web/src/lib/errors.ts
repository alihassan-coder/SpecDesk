/** Humanized error shape — same as the API's `{ error: {...} }` body. */
export interface HumanError {
  code: string;
  title: string;
  message: string;
  action: string;
}

const KNOWN: Record<string, Omit<HumanError, "code">> = {
  network: {
    title: "You seem to be offline",
    message: "SpecDesk couldn't reach the server.",
    action: "Check your connection and try again.",
  },
  rate_limited: {
    title: "Slow down a little",
    message: "You've started several plans in a short time.",
    action: "Try again in about 30 seconds.",
  },
  model_unavailable: {
    title: "The planning model is busy",
    message: "Our AI provider didn't answer in time. Your answers are saved.",
    action: "Retry — we'll switch to a backup model automatically.",
  },
  not_software: {
    title: "SpecDesk plans software",
    message: "This idea doesn't have an app or website in it yet.",
    action: "Describe the app you'd build for it, and we'll plan that.",
  },
  not_found: {
    title: "This plan isn't here",
    message: "It may have been deleted, or the link is wrong.",
    action: "Go back to your plans.",
  },
  forbidden: {
    title: "This plan belongs to someone else",
    message: "You can only open plans you created or that were shared with you.",
    action: "Ask the owner for a share link.",
  },
};

export function humanize(code: string): HumanError {
  const known = KNOWN[code];
  if (known) return { code, ...known };
  return {
    code,
    title: "Something went wrong on our side",
    message: "It's not something you did.",
    action: "Try again. If it keeps happening, refresh the page.",
  };
}
