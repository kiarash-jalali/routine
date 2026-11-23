import { cookies } from "next/headers";
import { Link } from "next-view-transitions";
import { pageMetadata } from "@/lib/server/pageMetadata";
import { getServerLocalDay } from "@/lib/server/localDay";
import { getWeekStartsOn, loadGroceryList, type GroceryList } from "@/lib/db/mealPlan";
import { isLanguage, languageCookieKey, locales, translate, type TranslationKey } from "@/lib/i18n";
import { needsBuying, sectionIndex } from "@/lib/nutrition/grocery";
import { localizedName } from "@/lib/nutrition/recipe";
import { resolveWeekStart } from "@/lib/nutrition/plan";
import { groceryAmountText, grocerySectionLabel } from "@/components/food/groceryText";
import { ErrorNotice, PageShell } from "@/components/ui";
import { requireServerUser } from "@/lib/supabase/requireUser";
import { PrintActions } from "./PrintActions";

export const dynamic = "force-dynamic";

// A box to tick on paper; decorative, not text.
const CHECKBOX = "☐ ";

export function generateMetadata() {
  return pageMetadata("food.grocery.printTitle");
}

/** A clean list in the user's language for whoever does the shopping. */
export default async function GroceryPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { supabase, userId } = await requireServerUser();
  const { week } = await searchParams;
  const saved = (await cookies()).get(languageCookieKey)?.value;
  const language = isLanguage(saved) ? saved : "en";
  const t = (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
  const number = (value: number) => new Intl.NumberFormat(locales[language]).format(value);
  const today = (await getServerLocalDay()) ?? new Date().toISOString().slice(0, 10);

  let list: GroceryList = null;
  let weekStart = today;
  let failed = false;
  try {
    const weekStartsOn = await getWeekStartsOn(userId, language, supabase);
    weekStart = resolveWeekStart(typeof week === "string" ? week : null, today, weekStartsOn);
    list = await loadGroceryList(weekStart, supabase);
  } catch {
    failed = true;
  }

  const items = (list?.items ?? []).filter(needsBuying);
  const sections = [...new Set(items.map((item) => item.grocery_section))].sort(
    (a, b) => sectionIndex(a) - sectionIndex(b),
  );
  const lines = (section: string) =>
    items
      .filter((item) => item.grocery_section === section)
      .map((item) => {
        const amount = groceryAmountText(item, t, number);
        const name = localizedName(language, item.name_en, item.name_fa);
        return amount ? `${name} — ${amount}` : name;
      });
  const title = `${t("food.grocery.printTitle")} · ${new Intl.DateTimeFormat(locales[language], {
    dateStyle: "medium",
  }).format(new Date(`${weekStart}T12:00:00`))}`;
  const shareText = [
    title,
    ...sections.flatMap((section) => ["", grocerySectionLabel(section, t), ...lines(section).map((line) => `- ${line}`)]),
  ].join("\n");

  return (
    <PageShell>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/food?tab=groceries&week=${weekStart}`} className="btn btn-ghost btn-sm">
          {t("food.grocery.back")}
        </Link>
        <PrintActions title={title} text={shareText} />
      </div>
      <h1 className="mb-5 text-2xl font-semibold">
        <bdi>{title}</bdi>
      </h1>
      {failed ? (
        <ErrorNotice>{t("food.grocery.loadError")}</ErrorNotice>
      ) : items.length === 0 ? (
        <p>{t("food.grocery.printEmpty")}</p>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section}>
              <h2 className="mb-2 font-semibold">{grocerySectionLabel(section, t)}</h2>
              <ul className="space-y-1">
                {lines(section).map((line, index) => (
                  <li key={index}>
                    <span aria-hidden="true">{CHECKBOX}</span>
                    <bdi>{line}</bdi>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
