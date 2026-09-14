"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Input,
  PageHeader,
  PageShell,
  SectionHeading,
  Select,
} from "@/components/ui";
import {
  addRoutine,
  listRoutines,
  removeRoutine,
  toggleRoutineActive,
} from "@/lib/db/routines";
import { getErrorMessage } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine } from "@/types/routine";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

function describeRoutine(routine: Routine) {
  const time = routine.preferred_time?.slice(0, 5) ?? "No time";

  if (routine.frequency === "daily") {
    return `Every day · ${time}`;
  }

  const dayLabels = DAYS.filter((day) =>
    (routine.days_of_week ?? []).includes(day.value),
  ).map((day) => day.label);

  return `${dayLabels.join(", ") || "No days selected"} · ${time}`;
}

export default function RoutinesPage() {
  const router = useRouter();

  const [loadingUser, setLoadingUser] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [preferredTime, setPreferredTime] = useState("09:00");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const supabase = supabaseBrowser();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!data.user) {
          router.replace("/login");
          return;
        }

        if (mounted) {
          setEmail(data.user.email ?? null);
          setUserId(data.user.id);
          setLoadingUser(false);
        }
      } catch {
        router.replace("/login");
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function fetchRoutines() {
    setErr(null);
    setLoading(true);

    try {
      setRoutines(await listRoutines());
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load routines"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    fetchRoutines();
  }, [userId]);

  function toggleDay(day: number) {
    setDaysOfWeek((current) => {
      const next = current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day];

      return next.sort((a, b) => a - b);
    });
  }

  const canCreate = useMemo(() => {
    if (!userId || !title.trim() || !preferredTime.trim()) return false;
    if (frequency === "weekly" && daysOfWeek.length === 0) return false;
    return true;
  }, [userId, title, preferredTime, frequency, daysOfWeek]);

  async function onCreate() {
    if (!userId || !canCreate) return;

    setCreating(true);
    setErr(null);

    try {
      await addRoutine({
        user_id: userId,
        title: title.trim(),
        frequency,
        days_of_week: frequency === "weekly" ? daysOfWeek : null,
        preferred_time:
          preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime,
      });

      setTitle("");
      await fetchRoutines();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to create routine"));
    } finally {
      setCreating(false);
    }
  }

  async function onToggleActive(routine: Routine) {
    setErr(null);
    setRoutines((current) =>
      current.map((item) =>
        item.id === routine.id
          ? { ...item, is_active: !item.is_active }
          : item,
      ),
    );

    try {
      await toggleRoutineActive(routine.id, !routine.is_active);
    } catch (error: unknown) {
      setRoutines((current) =>
        current.map((item) =>
          item.id === routine.id
            ? { ...item, is_active: routine.is_active }
            : item,
        ),
      );
      setErr(getErrorMessage(error, "Failed to update routine"));
    }
  }

  async function onDelete(routine: Routine) {
    setErr(null);
    setRoutines((current) =>
      current.filter((item) => item.id !== routine.id),
    );

    try {
      await removeRoutine(routine.id);
    } catch (error: unknown) {
      await fetchRoutines();
      setErr(getErrorMessage(error, "Failed to delete routine"));
    }
  }

  if (loadingUser) {
    return (
      <PageShell>
        <p className="text-sm text-muted">Loading routines…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Routine library"
        title="Build the rhythm you want."
        description={
          <>
            Keep routines simple and forgiving. You can pause them without
            deleting them.
            {email && <span className="ml-1 text-muted-soft">· {email}</span>}
          </>
        }
        actions={
          <>
            <Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
            <Button variant="ghost" onClick={fetchRoutines} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </>
        }
      />

      {err && (
        <div className="mt-6">
          <ErrorNotice>{err}</ErrorNotice>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <Card className="self-start">
          <SectionHeading
            title="Create a routine"
            description="Give it a name, rhythm, and a preferred time."
          />

          <div className="mt-5 space-y-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-foreground">Name</span>
              <Input
                placeholder="Reading, vitamins, stretching…"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Frequency
                </span>
                <Select
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(event.target.value as "daily" | "weekly")
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </Select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Preferred time
                </span>
                <Input
                  type="time"
                  value={preferredTime}
                  onChange={(event) => setPreferredTime(event.target.value)}
                  required
                />
              </label>
            </div>

            {frequency === "weekly" && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Days of week
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const active = daysOfWeek.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring ${
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-border-strong bg-surface text-muted hover:bg-surface-soft hover:text-foreground"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Pick at least one day for a weekly routine.
                </p>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              disabled={!canCreate || creating}
              onClick={onCreate}
            >
              {creating ? "Creating…" : "Create routine"}
            </Button>
          </div>
        </Card>

        <Card>
          <SectionHeading
            title="Your routines"
            description={`${routines.filter((routine) => routine.is_active).length} active · ${routines.length} total`}
          />

          {routines.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                No routines yet. Your first one can be something tiny.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {routines.map((routine) => (
                <li
                  key={routine.id}
                  className={`rounded-2xl border px-4 py-4 transition ${
                    routine.is_active
                      ? "border-border bg-surface-soft"
                      : "border-border bg-surface-soft/60"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`break-words font-medium ${
                            routine.is_active
                              ? "text-foreground"
                              : "text-muted line-through"
                          }`}
                        >
                          {routine.title}
                        </p>
                        {!routine.is_active && (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                            Paused
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {describeRoutine(routine)}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        className="min-h-8 px-3 py-1"
                        onClick={() => onToggleActive(routine)}
                      >
                        {routine.is_active ? "Pause" : "Resume"}
                      </Button>
                      <Button
                        variant="danger"
                        className="min-h-8 px-3 py-1"
                        onClick={() => onDelete(routine)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
