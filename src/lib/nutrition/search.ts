/**
 * Bilingual food and recipe search (docs/nutrition-roadmap.md S3).
 * Matches English and Persian names alike, so "قورمه" and "ghormeh" both work.
 */

// Arabic diacritics (harakat, tanwin, superscript alef) and tatweel.
const MARKS = /[ً-ٰٟـ]/g;
// Zero-width non-joiner/joiner and other invisible joiners used in Persian text.
const JOINERS = /[​-‏⁠﻿]/g;

/** Lowercase, unify Arabic/Persian letter variants, drop marks and joiners. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(MARKS, "")
    .replace(JOINERS, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every word of the query appears in one of the names. */
export function matchesSearch(
  query: string,
  names: ReadonlyArray<string | null | undefined>,
): boolean {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystacks = names
    .filter((name): name is string => Boolean(name))
    .map(normalizeSearch);
  // Words may match across languages: "ghormeh سبزی" still finds the dish.
  const joined = haystacks.join(" ");
  return words.every((word) => joined.includes(word));
}
