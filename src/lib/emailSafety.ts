const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "sharklasers.com",
  "trashmail.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
]);

const SUSPICIOUS_LOCAL_PARTS = [
  "test",
  "testing",
  "fake",
  "temp",
  "spam",
  "noreply",
  "no-reply",
];

export const validateEmailSafety = (email: string): { ok: boolean; message?: string } => {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split("@");

  if (parts.length !== 2) {
    return { ok: false, message: "Invalid email format" };
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain) {
    return { ok: false, message: "Invalid email format" };
  }

  if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) {
    return { ok: false, message: "Invalid email domain" };
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, message: "Disposable email addresses are not allowed" };
  }

  if (domain === "example.com" || domain.endsWith(".example")) {
    return { ok: false, message: "Use a real email address" };
  }

  if (SUSPICIOUS_LOCAL_PARTS.some((term) => localPart.includes(term))) {
    return { ok: false, message: "This email looks suspicious. Please use a personal email" };
  }

  return { ok: true };
};
