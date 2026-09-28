/**
 * The value a Server Action returns to a form.
 *
 * Kept out of `app/actions.ts` because a `"use server"` module may only export
 * async functions -- a plain object export is a build error. Keeping it here also
 * means the client form and the server action share one definition of "what
 * can come back".
 *
 * `fields` is keyed by request field path, matching the contract's
 * `ErrorResponse.fields`, so a validation message can be rendered next to the
 * input that caused it.
 */
export type ActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
  fields?: Record<string, string>;
  code?: string;
} | null;

export const IDLE: ActionState = { status: "idle" };

/**
 * A fixed sentence per failure mode.
 *
 * A supervisor should never see a PostgREST message quoting column names, and a
 * 500 must not read as a failed sign-in. Anything unmapped falls back to the
 * neutral line, which is also what a server fault produces.
 *
 * `INVALID_CREDENTIALS` is deliberately distinct from `UNAUTHORIZED`: they mean
 * opposite things to the person at the keyboard. Telling someone who mistyped
 * their password that their session has ended sends them looking for a problem
 * they do not have.
 */
export function messageFor(state: ActionState): string {
  if (!state || state.status !== "error") return "";
  switch (state.code) {
    case "INVALID_CREDENTIALS":
      return state.message ?? "That email and password combination was not recognised.";
    case "UNAUTHORIZED":
      return "Your session has ended. Sign in again to continue.";
    case "FORBIDDEN":
      return state.message ?? "Your role cannot do that.";
    case "VALIDATION":
      return state.message ?? "Check the highlighted fields.";
    case "VERSION_CONFLICT":
      return "Someone changed this a moment ago. Reload the page and try again.";
    case "DAY_LOCKED":
      return "This day has been locked, so it can no longer be changed.";
    case "BAD_TRANSITION":
      return state.message ?? "That has already been dealt with by someone else.";
    case "NOT_FOUND":
      return state.message ?? "That record does not exist, or is not yours to view.";
    default:
      return state.message ?? "That did not work. Nothing was changed.";
  }
}
