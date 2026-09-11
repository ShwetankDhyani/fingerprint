/** Case-insensitive email equality for confirm-email fields. */
export function emailsMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
