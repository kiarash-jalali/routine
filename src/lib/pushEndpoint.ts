// Restrict server outbound requests to known browser push services.
export function isValidPushEndpoint(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    value.trim() !== value
  )
    return false;
  try {
    const url = new URL(value),
      host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host === "web.push.apple.com" ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
