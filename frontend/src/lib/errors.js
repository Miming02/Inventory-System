/**
 * Normalize Supabase / PostgREST / generic errors for UI copy.
 * @param {unknown} err
 * @returns {string}
 */
export function getErrorMessage(err) {
  if (err == null) return "Something went wrong.";
  if (typeof err === "string") return err;
  if (typeof err.message === "string" && err.message.length > 0) return err.message;
  if (typeof err.details === "string" && err.details.length > 0) return err.details;
  if (typeof err.hint === "string" && err.hint.length > 0) return err.hint;
  try {
    return JSON.stringify(err);
  } catch {
    return "Something went wrong.";
  }
}
