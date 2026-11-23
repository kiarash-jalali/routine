import type { TranslationKey } from "@/lib/i18n";
import { groceryAmount, type GeneratedItem } from "@/lib/nutrition/grocery";

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/** "× 6", "1.5 kg" or "400 g" in the user's language; empty when there is no amount. */
export function groceryAmountText(
  item: Pick<GeneratedItem, "grams" | "count">,
  t: Translate,
  number: (value: number) => string,
): string {
  const amount = groceryAmount(item);
  if (!amount) return "";
  if (amount.unit === "count") return t("food.grocery.count", { value: number(amount.value) });
  if (amount.unit === "kg") return t("food.grocery.kg", { value: number(amount.value) });
  return t("food.gramsValue", { value: number(amount.value) });
}

export function grocerySectionLabel(section: string, t: Translate): string {
  return t(`food.grocery.section.${section}` as TranslationKey);
}
