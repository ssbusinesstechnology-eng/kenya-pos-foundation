/**
 * Translates raw auth/database errors into calm, human sentences.
 * Never surface raw Postgres / Supabase text to the user.
 */

type UnknownError = unknown;

const AUTH_MESSAGES: Array<{ match: RegExp; message: string }> = [
  { match: /user already registered|already been registered|duplicate key.*users/i, message: "This email is already registered. Try signing in instead." },
  { match: /invalid login credentials/i, message: "That email and password don't match. Please check and try again." },
  { match: /email not confirmed/i, message: "Please confirm your email first — check your inbox for the link we sent." },
  { match: /password should be at least/i, message: "Please choose a password with at least 6 characters." },
  { match: /weak password|password is too weak|pwned|leaked/i, message: "That password is too easy to guess. Please choose a stronger one." },
  { match: /unable to validate email|invalid email/i, message: "That email address doesn't look right." },
  { match: /email rate limit|too many requests|rate limit/i, message: "Too many attempts. Please wait a minute and try again." },
  { match: /new password should be different/i, message: "Your new password must be different from your current one." },
  { match: /auth session missing|session_not_found|jwt expired/i, message: "Your session has expired. Please sign in again." },
  { match: /same as the old password/i, message: "Your new password must be different from your current one." },
];

const DB_MESSAGES: Array<{ match: RegExp; message: string }> = [
  { match: /already belongs to a business/i, message: "This account is already set up with a business." },
  { match: /business name is required/i, message: "Please enter your business name." },
  { match: /not authenticated/i, message: "Your session has expired. Please sign in again." },
  { match: /cross-tenant/i, message: "You don't have access to that business." },
  { match: /row-level security|permission denied/i, message: "You don't have permission to do that." },
  { match: /violates check constraint/i, message: "Some of the details entered aren't valid. Please review and try again." },
  { match: /duplicate key|unique constraint/i, message: "That record already exists." },
  { match: /failed to fetch|network|timeout|fetch failed/i, message: "We couldn't reach the server. Check your connection and try again." },
];

function rawMessage(error: UnknownError): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message: unknown }).message ?? "");
  return "";
}

function translate(error: UnknownError, table: Array<{ match: RegExp; message: string }>, fallback: string) {
  const raw = rawMessage(error);
  if (!raw) return fallback;
  const hit = [...table, ...AUTH_MESSAGES, ...DB_MESSAGES].find((entry) => entry.match.test(raw));
  return hit ? hit.message : fallback;
}

export function friendlyAuthError(error: UnknownError): string {
  return translate(error, AUTH_MESSAGES, "Something went wrong while signing you in. Please try again.");
}

export function friendlyDataError(error: UnknownError): string {
  return translate(error, DB_MESSAGES, "We couldn't load or save that just now. Please try again.");
}
