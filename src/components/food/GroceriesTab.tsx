"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { Button, Card, EmptyState, ErrorNotice, Input, LoadingState } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { useFoodFormat } from "@/components/food/shared";
import { groceryAmountText, grocerySectionLabel } from "@/components/food/groceryText";
import {
  addManualItem,
  deleteGroceryItem,
  loadGroceryInputs,
  loadGroceryList,
  loadPlanEntries,
  saveGroceryList,
  setGroceryFlag,
  type GroceryFlag,
  type GroceryList,
} from "@/lib/db/mealPlan";
import {
  generateGroceries,
  groceriesChanged,
  mergeGroceries,
  needsBuying,
  sectionIndex,
  type SavedGroceryItem,
} from "@/lib/nutrition/grocery";
import { addDays } from "@/lib/nutrition/plan";
import {
  isOfflineLikeError,
  pendingGroceryFlags,
  queueGroceryFlag,
  removeOfflineMutations,
  saveGrocerySnapshot,
  setGrocerySnapshotFlag,
  settleOfflineSync,
  syncOfflineMutations,
} from "@/lib/offlineStore";

/** The saved list with ticks still waiting to sync applied on top. */
async function loadListWithPending(userId: string, weekStart: string): Promise<GroceryList> {
  const list = await loadGroceryList(weekStart);
  if (!list) return list;
  const pending = await pendingGroceryFlags(userId).catch(() => []);
  if (pending.length === 0) return list;
  return {
    ...list,
    items: list.items.map((item) =>
      pending
        .filter((mutation) => mutation.itemId === item.id)
        .reduce((current, mutation) => ({ ...current, [mutation.field]: mutation.value }), item),
    ),
  };
}

/**
 * Builds the list from this week's plan (read fresh, so a plan changed on
 * another device is used), merges it with the saved list and writes only
 * when something changed. With `includeStaples` null the saved setting is kept.
 */
async function syncList(
  userId: string,
  weekStart: string,
  includeStaples: boolean | null,
): Promise<GroceryList> {
  // Ticks queued offline land first, so the loaded list already shows them.
  await syncOfflineMutations(userId).catch(() => undefined);
  const [saved, planned] = await Promise.all([
    loadListWithPending(userId, weekStart),
    loadPlanEntries(weekStart),
  ]);
  const entries = planned.filter((entry) => entry.plan_date >= weekStart);
  const staples = includeStaples ?? saved?.include_staples ?? false;
  const recipeIds = [...new Set(entries.flatMap((entry) => (entry.recipe_id ? [entry.recipe_id] : [])))];
  const foodIds = [...new Set(entries.flatMap((entry) => (entry.food_id ? [entry.food_id] : [])))];
  const inputs = await loadGroceryInputs(recipeIds, foodIds);
  const generated = generateGroceries(entries, inputs.recipes, inputs.foods, staples);
  const savedItems = saved?.items ?? [];
  const merged = mergeGroceries(savedItems, generated);
  const staplesChanged = saved ? saved.include_staples !== staples : staples;
  if (!groceriesChanged(savedItems, merged) && !staplesChanged) return saved;
  await saveGroceryList(weekStart, staples, merged);
  return loadListWithPending(userId, weekStart);
}

const bySection = (a: SavedGroceryItem, b: SavedGroceryItem) =>
  sectionIndex(a.grocery_section) - sectionIndex(b.grocery_section);

/** Keyed by week in FoodClient, so a week change starts from an empty state. */
export function GroceriesTab({
  userId,
  weekStart,
  currentWeekStart,
  onChangeWeek,
  onOpenPlan,
}: {
  userId: string;
  weekStart: string;
  currentWeekStart: string;
  onChangeWeek: (weekStart: string) => void;
  onOpenPlan: () => void;
}) {
  const { t, date, number, language } = useLanguage();
  const format = useFoodFormat();
  const [list, setList] = useState<GroceryList>(null);
  const [staples, setStaples] = useState<boolean | null>(null);
  const key = `${weekStart}#${staples}`;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [queued, setQueued] = useState(false);
  const [pending, setPending] = useState(false);
  const [newItem, setNewItem] = useState("");
  const loading = syncedKey !== key;

  // The list being shopped for (this week or next) is kept for offline use,
  // sorted by section so the offline page groups it the same way.
  function saveSnapshot(value: GroceryList) {
    if (!value || (weekStart !== currentWeekStart && weekStart !== addDays(currentWeekStart, 7))) return;
    void saveGrocerySnapshot({
      version: 1,
      userId,
      language,
      savedAt: new Date().toISOString(),
      weekStart,
      title: t("food.grocery.week", { date: date(weekStart) }),
      items: [...value.items].sort(bySection).map((item) => ({
        id: item.id,
        label: format.name(item.name_en, item.name_fa),
        amount: groceryAmountText(item, t, number),
        section: grocerySectionLabel(item.grocery_section, t),
        have: item.have,
        bought: item.bought,
      })),
    }).catch(() => undefined);
  }
  const persist = useEffectEvent((value: GroceryList) => saveSnapshot(value));

  useEffect(() => {
    let cancelled = false;
    syncList(userId, weekStart, staples)
      .then((value) => {
        if (cancelled) return;
        setList(value);
        setLoadError(false);
        setSyncedKey(key);
        persist(value);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setSyncedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, weekStart, staples, key]);

  const items = list?.items ?? [];
  const includeStaples = staples ?? list?.include_staples ?? false;

  function setFlag(id: string, field: GroceryFlag, value: boolean) {
    setList((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)) }
        : current,
    );
  }

  async function tick(item: SavedGroceryItem, field: GroceryFlag, value: boolean) {
    setActionError(false);
    setQueued(false);
    setFlag(item.id, field, value);
    try {
      await settleOfflineSync(userId);
      await setGroceryFlag(userId, item.id, field, value);
      // A tick queued earlier while offline must not undo this one when it syncs.
      await removeOfflineMutations([`grocery:${userId}:${item.id}:${field}`]).catch(() => undefined);
      await setGrocerySnapshotFlag(userId, item.id, field, value).catch(() => undefined);
    } catch (error) {
      if (isOfflineLikeError(error)) {
        try {
          await queueGroceryFlag(userId, weekStart, item.id, field, value);
          setQueued(true);
          return;
        } catch {
          /* fall through to the error */
        }
      }
      setFlag(item.id, field, !value);
      setActionError(true);
    }
  }

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setActionError(false);
    try {
      await action();
      const value = await loadListWithPending(userId, weekStart);
      setList(value);
      saveSnapshot(value);
    } catch {
      setActionError(true);
    } finally {
      setPending(false);
    }
  }

  function addItem() {
    const text = newItem.trim().slice(0, 160);
    if (!text) return;
    void run(async () => {
      await addManualItem(weekStart, {
        name_en: language === "en" ? text : null,
        name_fa: language === "fa" ? text : null,
      });
      setNewItem("");
    });
  }

  const sections = [...new Set(items.map((item) => item.grocery_section))].sort(
    (a, b) => sectionIndex(a) - sectionIndex(b),
  );
  const toBuy = items.filter(needsBuying).length;
  const locked = loading || pending;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("food.plan.prevWeek")}
          disabled={locked}
          onClick={() => onChangeWeek(addDays(weekStart, -7))}
        >
          <Icon name="chevron" size={16} className="rotate-180" />
        </Button>
        <h2 className="min-w-0 font-semibold">
          <bdi>{t("food.grocery.week", { date: date(weekStart) })}</bdi>
        </h2>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("food.plan.nextWeek")}
          disabled={locked}
          onClick={() => onChangeWeek(addDays(weekStart, 7))}
        >
          <Icon name="chevron" size={16} />
        </Button>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={includeStaples}
          disabled={locked}
          onChange={(event) => setStaples(event.target.checked)}
        />
        {t("food.grocery.staples")}
      </label>

      {loadError && <ErrorNotice>{t("food.grocery.loadError")}</ErrorNotice>}
      {actionError && <ErrorNotice>{t("food.grocery.saveError")}</ErrorNotice>}
      {queued && <p role="status" className="notice">{t("food.grocery.queued")}</p>}

      {loading && !list ? (
        <LoadingState label={t("common.loading")} />
      ) : items.length === 0 ? (
        !loadError && (
          <EmptyState title={t("food.grocery.emptyTitle")}>
            {t("food.grocery.empty")}{" "}
            <button type="button" className="underline" onClick={onOpenPlan}>
              {t("food.grocery.goToPlan")}
            </button>
          </EmptyState>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" role="status">
              {toBuy > 0 ? t("food.grocery.toBuy", { count: number(toBuy) }) : t("food.grocery.allDone")}
            </p>
            <Link href={`/food/groceries/print?week=${weekStart}`} className="btn btn-secondary btn-sm">
              {t("food.grocery.print")}
            </Link>
          </div>
          {sections.map((section) => (
            <section key={section} className="space-y-2">
              <h3 className="text-sm font-semibold">{grocerySectionLabel(section, t)}</h3>
              <Card className="p-0">
                <ul className="divide-y divide-border">
                  {items
                    .filter((item) => item.grocery_section === section)
                    .map((item) => {
                      const amount = groceryAmountText(item, t, number);
                      return (
                        <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <span className={`min-w-0 flex-1 ${needsBuying(item) ? "" : "text-muted line-through"}`}>
                            <bdi className="font-medium">{format.name(item.name_en, item.name_fa)}</bdi>
                            {amount && (
                              <>
                                {" · "}
                                <bdi className="text-sm">{amount}</bdi>
                              </>
                            )}
                            {item.is_manual && (
                              <span className="text-xs text-muted"> · {t("food.grocery.manual")}</span>
                            )}
                          </span>
                          {(["have", "bought"] as const).map((field) => (
                            <label key={field} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                checked={item[field]}
                                disabled={loading}
                                onChange={(event) => void tick(item, field, event.target.checked)}
                              />
                              {t(field === "have" ? "food.grocery.have" : "food.grocery.bought")}
                            </label>
                          ))}
                          {item.is_manual && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t("food.grocery.deleteItem")}
                              disabled={locked}
                              onClick={() => void run(() => deleteGroceryItem(userId, item.id))}
                            >
                              <Icon name="trash" size={14} />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addItem();
        }}
      >
        <Input
          className="min-w-0 flex-1 basis-48"
          value={newItem}
          maxLength={160}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder={t("food.grocery.itemName")}
          aria-label={t("food.grocery.itemName")}
        />
        <Button type="submit" busy={pending} disabled={loading || !newItem.trim()}>
          <Icon name="plus" size={16} />
          {t("food.grocery.addItem")}
        </Button>
      </form>
    </div>
  );
}
