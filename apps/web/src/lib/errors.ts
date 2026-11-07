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
  // --- sign-in (Better Auth) and the API proxy ---
  sign_in_required: {
    title: "Please log in",
    message: "You need to be logged in to do that.",
    action: "Log in with your email to continue.",
  },
  session_expired: {
    title: "Your session expired",
    message: "For your security, logins don't last forever.",
    action: "Log in again.",
  },
  admin_only: {
    title: "Admins only",
    message: "This area is for the SpecDesk team. Your account isn't on the admin list.",
    action: "Go back to your plans, or log in with an admin email.",
  },
  api_unreachable: {
    title: "SpecDesk's server isn't answering",
    message: "The website couldn't reach the planning API. It may be stopped or restarting.",
    action: "Try again in a moment.",
  },
  invalid_email: {
    title: "Check your email address",
    message: "That doesn't look like an email address.",
    action: "Fix any typos and try again.",
  },
  invalid_otp: {
    title: "That code isn't right",
    message: "It doesn't match the latest code we emailed you.",
    action: "Check the newest email from SpecDesk, or send a new code.",
  },
  otp_expired: {
    title: "That code has expired",
    message: "Codes only work for 5 minutes.",
    action: "Send a new code and enter it right away.",
  },
  too_many_attempts: {
    title: "Too many tries",
    message: "That code is locked after several wrong attempts.",
    action: "Send a new code and try again.",
  },
  too_many_codes: {
    title: "Slow down a little",
    message: "You've asked for several codes in a short time.",
    action: "Wait a minute, then try again.",
  },
  code_not_sent: {
    title: "We couldn't send your code",
    message: "Something went wrong while emailing your login code.",
    action: "Wait a moment, then try again.",
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
