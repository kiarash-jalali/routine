"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { Button, Card, EmptyState, ErrorNotice, Input, SectionHeading, SegmentedControl, Select } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { ConfirmDelete, useFoodFormat } from "@/components/food/shared";
import { LogTotals } from "@/components/food/LogTotals";
import { QuickAddSheet, type FoodCatalog } from "@/components/food/QuickAddSheet";
import { WeekChart } from "@/components/food/WeekChart";
import {
  addLogEntry,
  deleteLogEntry,
  loadFoodDay,
  updateLogEntry,
  type FoodDay,
  type FoodLogEntry,
  type LogEntryUpdate,
} from "@/lib/db/foodLog";
import { dayFromNumber, dayNumber } from "@/lib/nutrition/body";
import {
  MAX_LOG_GRAMS,
  MEAL_SLOTS,
  PORTION_OPTIONS,
  dailySeries,
  dailyTargets,
  dayTotals,
  isMealSlot,
  rescaleEntry,
  validateQuick,
  type LogDraft,
  type MealSlot,
  type QuickError,
} from "@/lib/nutrition/log";
import { parseAmount } from "@/lib/nutrition/recipe";
import { getLocalDateKey } from "@/lib/today";
import { useToday } from "@/lib/useToday";

/** `/food` → Log: one day's entries by slot, day totals and the last 7 days. */
export function LogTab({
  userId,
  serverDay,
  explicitDay,
  initialDay,
  catalog,
}: {
  userId: string;
  serverDay: string;
  /** True when the URL named the day; otherwise the device's today wins. */
  explicitDay: boolean;
  initialDay: FoodDay | null;
  catalog: FoodCatalog;
}) {
  const { t, date, number } = useLanguage();
  const format = useFoodFormat();
  const clientToday = getLocalDateKey(useToday());
  const [data, setData] = useState<FoodDay | null>(initialDay);
  const [day, setDay] = useState(initialDay?.day ?? serverDay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // The server only knows its own (or the cookie's) day; follow the device's.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device day is only known after hydration
    if (!explicitDay && clientToday !== serverDay) setDay(clientToday);
  }, [clientToday, explicitDay, serverDay]);

  useEffect(() => {
    if (data?.day === day) return;
    let cancelled = false;
    loadFoodDay(userId, day)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, data?.day, day, userId]);

  function goTo(next: string) {
    setDay(next);
    // URL only (Next syncs history state): a router navigation would re-render
    // the whole hub on the server just to change the day.
    window.history.replaceState(window.history.state, "", `/food?tab=log&day=${next}`);
  }

  async function act(action: () => Promise<void>) {
    if (busy) return false;
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
      setBusy(false);
      return false;
    }
    // The write succeeded: a failed refresh must not look like a failed save
    // (a retry would log the entry twice).
    try {
      setData(await loadFoodDay(userId, day));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
    return true;
  }

  const current = data?.day === day ? data : null;
  const entries = current?.entries ?? [];
  const targets = current
    ? dailyTargets(current.profile, current.weighIns, current.adjustments, day)
    : null;
  const totals = dayTotals(entries);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="group" aria-label={t("foodLog.dayNav")}>
          <Button size="sm" aria-label={t("foodLog.prevDay")} onClick={() => goTo(dayFromNumber(dayNumber(day) - 1))}>
            <Icon name="chevron" size={16} className="rotate-180 rtl:rotate-0" />
          </Button>
          <p className="min-w-32 text-center font-semibold text-foreground">
            {day === clientToday ? t("common.today") : date(day, { weekday: "short", month: "short", day: "numeric" })}
          </p>
          <Button
            size="sm"
            aria-label={t("foodLog.nextDay")}
            disabled={day >= clientToday}
            onClick={() => goTo(dayFromNumber(dayNumber(day) + 1))}
          >
            <Icon name="chevron" size={16} className="rtl:rotate-180" />
          </Button>
          {day !== clientToday && (
            <Button size="sm" variant="ghost" onClick={() => goTo(clientToday)}>
              {t("common.today")}
            </Button>
          )}
        </div>
        <Button variant="primary" disabled={!current} onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} />
          {t("foodLog.add")}
        </Button>
      </div>

      {error && (
        <ErrorNotice>
          {t("common.error")}{" "}
          {!current && (
            <Button size="sm" variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
              {t("common.retry")}
            </Button>
          )}
        </ErrorNotice>
      )}

      {current && (
        <>
          <Card>
            <SectionHeading title={t("foodLog.dayTotals")} />
            <div className="mt-4">
              <LogTotals targets={targets} totals={totals} />
            </div>
          </Card>

          {entries.length === 0 ? (
            <EmptyState>{t("foodLog.dayEmpty")}</EmptyState>
          ) : (
            MEAL_SLOTS.map((slot) => {
              const inSlot = entries.filter((entry) => entry.slot === slot);
              if (inSlot.length === 0) return null;
              return (
                <section key={slot}>
                  <SectionHeading title={t(`foodLog.slot.${slot}`)} />
                  <ul className="mt-3 grid gap-2">
                    {inSlot.map((entry) => (
                      <li key={entry.id} className="list-row">
                        <div className="min-w-0 flex-1">
                          <p className="row-title">
                            <bdi>{entry.label}</bdi>
                          </p>
                          <p className="row-detail">
                            {[
                              entry.portions !== null &&
                                t("foodLog.portionsValue", { value: number(Number(entry.portions)) }),
                              entry.grams !== null && format.grams(Number(entry.grams)),
                              format.kcal(Number(entry.kcal)),
                              format.protein(Number(entry.protein)),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={busy}
                          aria-label={`${t("common.edit")}: ${entry.label}`}
                          onClick={() => setEditing(entry)}
                        >
                          {t("common.edit")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          <Card>
            <WeekChart
              points={dailySeries(current.week, day)}
              kcalTarget={targets?.energy.kcal ?? null}
            />
          </Card>
          <p className="text-xs leading-5 text-muted">{t("foodLog.privacy")}</p>
        </>
      )}

      <QuickAddSheet
        open={adding}
        onClose={() => setAdding(false)}
        catalog={catalog}
        recent={current?.recent ?? []}
        busy={busy}
        error={error}
        onAdd={async (draft: LogDraft) => {
          const ok = await act(async () => {
            await addLogEntry(userId, day, draft);
          });
          if (ok) setAdding(false);
          return ok;
        }}
      />

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        busy={busy}
        title={t("foodLog.editTitle")}
      >
        {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
        {editing && (
          <EntryForm
            key={editing.id}
            entry={editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (values) => {
              const target = editing;
              const ok = await act(() => updateLogEntry(userId, target.id, values));
              if (ok) setEditing(null);
            }}
            onDelete={async () => {
              const target = editing;
              const ok = await act(() => deleteLogEntry(userId, target.id));
              if (ok) setEditing(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function EntryForm({
  entry,
  busy,
  onCancel,
  onSave,
  onDelete,
}: {
  entry: FoodLogEntry;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: LogEntryUpdate) => void;
  onDelete: () => void;
}) {
  const { t, number } = useLanguage();
  const format = useFoodFormat();
  const id = useId();
  const isQuick = entry.portions === null && entry.grams === null;
  const [slot, setSlot] = useState<MealSlot>(isMealSlot(entry.slot) ? entry.slot : "snack");
  const [portions, setPortions] = useState(String(Number(entry.portions ?? 1)));
  const [grams, setGrams] = useState(String(Number(entry.grams ?? 0)));
  const [label, setLabel] = useState(entry.label);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [protein, setProtein] = useState(String(Number(entry.protein)));
  const [formError, setFormError] = useState<QuickError | "grams" | null>(null);

  const base = {
    portions: entry.portions === null ? null : Number(entry.portions),
    grams: entry.grams === null ? null : Number(entry.grams),
    kcal: Number(entry.kcal),
    protein: Number(entry.protein),
    fat: Number(entry.fat),
    carbs: Number(entry.carbs),
  };
  const gramsValue = parseAmount(grams);
  const scaled =
    entry.portions !== null
      ? rescaleEntry(base, { portions: Number(portions) })
      : entry.grams !== null && Number.isFinite(gramsValue) && gramsValue > 0
        ? rescaleEntry(base, { grams: gramsValue })
        : base;
  const portionOptions = [...new Set([...PORTION_OPTIONS, base.portions ?? 1])].sort((a, b) => a - b);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (isQuick) {
          const values = {
            label,
            kcal: parseAmount(kcal),
            protein: protein.trim() ? parseAmount(protein) : 0,
          };
          const problem = validateQuick(values);
          setFormError(problem);
          if (problem) return;
          onSave({
            slot,
            label: values.label.trim(),
            portions: null,
            grams: null,
            kcal: Math.round(values.kcal),
            protein: Math.round((values.protein ?? 0) * 10) / 10,
            fat: base.fat,
            carbs: base.carbs,
          });
          return;
        }
        if (entry.grams !== null && (!Number.isFinite(gramsValue) || gramsValue <= 0 || gramsValue > MAX_LOG_GRAMS)) {
          setFormError("grams");
          return;
        }
        setFormError(null);
        onSave({ slot, label: entry.label, ...scaled });
      }}
    >
      <label className="grid gap-2 text-sm" htmlFor={`${id}-slot`}>
        {t("foodLog.slot")}
        <Select
          id={`${id}-slot`}
          value={slot}
          onChange={(event) => {
            if (isMealSlot(event.target.value)) setSlot(event.target.value);
          }}
        >
          {MEAL_SLOTS.map((value) => (
            <option key={value} value={value}>
              {t(`foodLog.slot.${value}`)}
            </option>
          ))}
        </Select>
      </label>

      {isQuick ? (
        <>
          <label className="grid gap-2 text-sm" htmlFor={`${id}-label`}>
            {t("foodLog.label")}
            <Input
              id={`${id}-label`}
              value={label}
              maxLength={200}
              invalid={formError === "label"}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm" htmlFor={`${id}-kcal`}>
              {t("foodLog.kcal")}
              <Input
                id={`${id}-kcal`}
                inputMode="numeric"
                value={kcal}
                invalid={formError === "kcal"}
                onChange={(event) => setKcal(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor={`${id}-protein`}>
              {t("foodLog.protein")}
              <Input
                id={`${id}-protein`}
                inputMode="decimal"
                value={protein}
                invalid={formError === "protein"}
                onChange={(event) => setProtein(event.target.value)}
              />
            </label>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-foreground">
            <bdi>{entry.label}</bdi>
          </p>
          {entry.portions !== null ? (
            <SegmentedControl
              label={t("foodLog.portions")}
              value={portions}
              onChange={setPortions}
              options={portionOptions.map((value) => ({ value: String(value), label: number(value) }))}
            />
          ) : (
            <label className="grid gap-2 text-sm" htmlFor={`${id}-grams`}>
              {t("foodLog.grams")}
              <Input
                id={`${id}-grams`}
                inputMode="decimal"
                value={grams}
                invalid={formError === "grams"}
                onChange={(event) => setGrams(event.target.value)}
              />
            </label>
          )}
          <p className="text-sm text-muted">
            <bdi>
              {format.kcal(scaled.kcal)} · {format.protein(scaled.protein)}
            </bdi>
          </p>
          <p className="text-xs text-muted">{t("foodLog.snapshotNote")}</p>
        </>
      )}

      {formError && <ErrorNotice>{t(`foodLog.error.${formError}`)}</ErrorNotice>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" busy={busy} disabled={busy}>
          {t("common.save")}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
      <ConfirmDelete
        label={t("common.delete")}
        question={t("foodLog.deleteQuestion")}
        busy={busy}
        onConfirm={onDelete}
      />
    </form>
  );
}
