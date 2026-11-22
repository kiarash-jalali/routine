/**
 * Structured workouts (docs/nutrition-roadmap.md S6). Pure, unit-tested.
 */

export type RepScheme = {
  sets: number;
  /** Target (top) reps for each set, e.g. [15, 12, 10] for a pyramid. */
  reps: number[];
  /** Lowest reps of a range such as "3x8-12", per set; equals `reps` otherwise. */
  minReps: number[];
  eachSide: boolean;
};

export type ParsedExercise = {
  name: string;
  target_sets: number;
  rep_scheme: string;
  /** False when no scheme was found and the user should fix the row. */
  parsed: boolean;
};

export type SetLog = { set_number: number; reps: number };

const TIMES = "[x×*]";
const EACH_SIDE = /\b(each|per)\s+(leg|side|arm)\b|هر\s*(طرف|پا|دست)/i;
const SEPARATOR = /\s*(?:—|–|-|:|\|)\s*/;
/** A scheme must not run straight into more digits ("3x10-1000", "15/12/1000"). */
const END = String.raw`(?![\d./-])`;
const SETS_BY_REPS = String.raw`\d{1,2}\s*${TIMES}\s*\d{1,3}(?:\s*-\s*\d{1,3})?`;
const PYRAMID = String.raw`\d{1,3}(?:\s*/\s*\d{1,3})+`;

function toLatinDigits(text: string) {
  return text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function clampInt(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** "3x10", "3 × 12 each leg", "3x8-12", "15/12/10" → scheme; otherwise null. */
export function parseRepScheme(input: string): RepScheme | null {
  const text = toLatinDigits(input).trim();
  if (!text) return null;
  const eachSide = EACH_SIDE.test(text);

  const setsByReps = new RegExp(`^(\\d{1,2})\\s*${TIMES}\\s*(\\d{1,3})(?:\\s*-\\s*(\\d{1,3}))?${END}`, "i").exec(text);
  if (setsByReps) {
    const sets = Number(setsByReps[1]);
    const low = Number(setsByReps[2]);
    const high = setsByReps[3] ? Number(setsByReps[3]) : low;
    if (!clampInt(sets, 1, 20) || !clampInt(low, 1, 200) || !clampInt(high, low, 200)) return null;
    return {
      sets,
      reps: Array<number>(sets).fill(high),
      minReps: Array<number>(sets).fill(low),
      eachSide,
    };
  }

  const pyramid = new RegExp(`^(${PYRAMID})${END}`).exec(text);
  if (pyramid?.[1]) {
    const reps = pyramid[1].split("/").map((part) => Number(part.trim()));
    if (reps.length > 20 || reps.some((rep) => !clampInt(rep, 1, 200))) return null;
    return { sets: reps.length, reps, minReps: reps, eachSide };
  }
  return null;
}

/**
 * Converts free-text exercises (one per line, "name — sets x reps") into
 * structured rows. Lines without a recognisable scheme keep their text as the
 * name with `parsed: false` so the user can fix them.
 */
export function parseExerciseLines(text: string): ParsedExercise[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((line) => {
      // Digit conversion keeps string length, so indexes match `line`.
      const normalized = toLatinDigits(line);
      // Where a scheme could start ("3x10", "3 × 12", "15/12/10"), never in the
      // middle of a number. The last one wins: "Half-kneeling 1/2 press 3x10".
      const finder = new RegExp(String.raw`\d{1,2}\s*${TIMES}\s*\d|\d{1,3}\s*/\s*\d`, "gi");
      const starts = [...normalized.matchAll(finder)]
        .map((match) => match.index)
        .filter((index) => index === 0 || !/[\d/.]/.test(normalized[index - 1] ?? ""))
        .reverse();
      for (const index of starts) {
        let name: string;
        let scheme: string;
        if (index > 0) {
          name = line.slice(0, index).replace(new RegExp(`${SEPARATOR.source}$`), "").trim();
          scheme = line.slice(index).trim();
        } else {
          // Scheme first: "3x10 Squats".
          const lead = new RegExp(`^(?:${SETS_BY_REPS}|${PYRAMID})${END}`, "i").exec(normalized);
          if (!lead) continue;
          scheme = line.slice(0, lead[0].length).trim();
          name = line.slice(lead[0].length).replace(new RegExp(`^${SEPARATOR.source}`), "").trim();
        }
        const parsed = parseRepScheme(scheme);
        if (name && parsed) {
          return {
            name: name.slice(0, 120),
            target_sets: parsed.sets,
            rep_scheme: scheme.slice(0, 40),
            parsed: true,
          };
        }
      }
      return { name: line.slice(0, 120), target_sets: 3, rep_scheme: "", parsed: false };
    });
}

/**
 * "Try the next weight step" when every target set in the last session
 * reached the top of the scheme.
 */
export function readyToProgress(scheme: string, lastSession: SetLog[]): boolean {
  const parsed = parseRepScheme(scheme);
  if (!parsed || lastSession.length === 0) return false;
  return parsed.reps.every((target, index) => {
    const log = lastSession.find((item) => item.set_number === index + 1);
    return Boolean(log && log.reps >= target);
  });
}

/** Target reps for a given 1-based set number, for prefill when there is no history. */
export function targetRepsFor(scheme: string, setNumber: number): number | null {
  const parsed = parseRepScheme(scheme);
  return parsed?.reps[setNumber - 1] ?? null;
}
