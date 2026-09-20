import type { Language } from "@/lib/i18n";

export type MomentCopyKey =
  | "task_added"
  | "task_completed"
  | "task_reopened"
  | "task_deleted"
  | "routine_added"
  | "routine_updated"
  | "routine_paused"
  | "routine_resumed"
  | "routine_deleted"
  | "checkin_task_completed"
  | "checkin_routine_completed"
  | "day_saved"
  | "feedback_sent"
  | "profile_saved"
  | "email_saved"
  | "password_saved"
  | "reminder_enabled"
  | "reminder_saved"
  | "reminder_disabled";

type MomentLine = {
  title: string;
  detail?: string;
};

// Event copy lives behind stable keys instead of being baked into animation
// components. When localization arrives, these keys can map to per-locale files
// without changing the event logic or popup UI.
const englishMoments: Record<MomentCopyKey, readonly MomentLine[]> = {
  task_added: [
    { title: "Task added.", detail: "Captured before it escaped." },
    { title: "On the list.", detail: "One less thing to keep in your head." },
    { title: "Got it.", detail: "You can come back to it when it matters." },
  ],
  task_completed: [
    { title: "Nice. That’s done.", detail: "One less thing humming in the background." },
    { title: "Checked off.", detail: "Tiny wins still count." },
    { title: "Done and dusted.", detail: "Your future self says thanks." },
  ],
  task_reopened: [
    { title: "Back in play.", detail: "Plans change. No drama." },
    { title: "Reopened.", detail: "It can wait for another pass." },
  ],
  task_deleted: [
    { title: "Task removed.", detail: "A little less clutter." },
  ],
  routine_added: [
    { title: "Routine added.", detail: "A small rhythm starts here." },
    { title: "That’s a rhythm.", detail: "Keep it small enough to return to." },
  ],
  routine_updated: [
    { title: "Routine updated.", detail: "Your plan can move with your life." },
  ],
  routine_paused: [
    { title: "Routine paused.", detail: "Space is part of a good rhythm too." },
  ],
  routine_resumed: [
    { title: "Routine resumed.", detail: "Welcome back." },
  ],
  routine_deleted: [
    { title: "Routine removed.", detail: "Only keep what still helps." },
  ],
  checkin_task_completed: [
    { title: "Task counted.", detail: "That one’s off your plate." },
    { title: "Nice one.", detail: "A small finish is still a finish." },
  ],
  checkin_routine_completed: [
    { title: "Routine counted.", detail: "Small repetitions add up." },
    { title: "You showed up.", detail: "That’s the part that matters." },
  ],
  day_saved: [
    { title: "Day saved.", detail: "Imperfect still counts." },
    { title: "That day is yours.", detail: "You showed up and recorded it." },
  ],
  feedback_sent: [
    { title: "Feedback sent.", detail: "Thanks — this is how Routine gets better." },
  ],
  profile_saved: [{ title: "Profile updated.", detail: "Looking good." }],
  email_saved: [{ title: "Email updated.", detail: "Your sign-in details are current." }],
  password_saved: [{ title: "Password updated.", detail: "Your new password is ready." }],
  reminder_enabled: [
    { title: "Reminder enabled.", detail: "Routine will nudge you gently." },
  ],
  reminder_saved: [
    { title: "Reminder time saved.", detail: "We’ll use your device timezone." },
  ],
  reminder_disabled: [
    { title: "Reminder turned off.", detail: "Quiet mode, by choice." },
  ],
};

const persianMoments: Record<MomentCopyKey, readonly MomentLine[]> = {
  task_added: [{ title: "کار اضافه شد.", detail: "دیگر لازم نیست در ذهنت نگهش داری." }],
  task_completed: [{ title: "انجام شد.", detail: "بردهای کوچک هم حساب می‌شوند." }],
  task_reopened: [{ title: "دوباره باز شد.", detail: "برنامه‌ها تغییر می‌کنند." }],
  task_deleted: [{ title: "کار حذف شد.", detail: "کمی فضای خلوت‌تر." }],
  routine_added: [{ title: "روتین اضافه شد.", detail: "یک ریتم کوچک از همین‌جا شروع می‌شود." }],
  routine_updated: [{ title: "روتین به‌روز شد.", detail: "برنامه می‌تواند با زندگی‌ات تغییر کند." }],
  routine_paused: [{ title: "روتین متوقف شد.", detail: "استراحت هم بخشی از یک ریتم خوب است." }],
  routine_resumed: [{ title: "روتین دوباره فعال شد.", detail: "خوش برگشتی." }],
  routine_deleted: [{ title: "روتین حذف شد.", detail: "فقط چیزهایی را نگه دار که کمک می‌کنند." }],
  checkin_task_completed: [{ title: "کار ثبت شد.", detail: "یک کار کمتر روی دوشت." }],
  checkin_routine_completed: [{ title: "روتین ثبت شد.", detail: "تکرارهای کوچک جمع می‌شوند." }],
  day_saved: [{ title: "روزت ثبت شد.", detail: "لازم نیست بی‌نقص باشد." }],
  feedback_sent: [{ title: "بازخورد ارسال شد.", detail: "ممنون؛ همین‌ها روتین را بهتر می‌کنند." }],
  profile_saved: [{ title: "پروفایل به‌روز شد." }],
  email_saved: [{ title: "ایمیل به‌روز شد." }],
  password_saved: [{ title: "رمز عبور به‌روز شد." }],
  reminder_enabled: [{ title: "یادآوری فعال شد.", detail: "روتین آرام یادت می‌اندازد." }],
  reminder_saved: [{ title: "زمان یادآوری ذخیره شد." }],
  reminder_disabled: [{ title: "یادآوری خاموش شد.", detail: "سکوت، با انتخاب خودت." }],
};

function currentMomentLanguage(): Language {
  return typeof document !== "undefined" && document.documentElement.lang === "fa"
    ? "fa"
    : "en";
}

export function getMomentCopy(
  key: MomentCopyKey,
  language: Language = currentMomentLanguage(),
): MomentLine {
  const options = language === "fa" ? persianMoments[key] : englishMoments[key];
  const fallback = options[0];
  if (!fallback) throw new Error(`moment_copy_missing:${key}`);
  return options[Math.floor(Math.random() * options.length)] ?? fallback;
}
