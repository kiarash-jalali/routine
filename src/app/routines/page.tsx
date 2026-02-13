"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine } from "@/types/routine";
import {
  addRoutine,
  listRoutines,
  removeRoutine,
  toggleRoutineActive,
} from "@/lib/db/routines";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

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
      const { data, error } = await listRoutines();
      if (error) throw error;
      setRoutines((data ?? []) as Routine[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load routines");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    fetchRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => {
      const has = prev.includes(day);
      const next = has ? prev.filter((d) => d !== day) : [...prev, day];
      next.sort((a, b) => a - b);
      return next;
    });
  }

  const canCreate = useMemo(() => {
    if (!userId) return false;
    if (!title.trim()) return false;
    if (!preferredTime.trim()) return false;
    if (frequency === "weekly" && daysOfWeek.length === 0) return false;
    return true;
  }, [userId, title, preferredTime, frequency, daysOfWeek]);

  async function onCreate() {
    if (!userId || !canCreate) return;

    setCreating(true);
    setErr(null);

    try {
      const days = frequency === "weekly" ? daysOfWeek : null;

      const { error } = await addRoutine({
        user_id: userId,
        title: title.trim(),
        frequency,
        days_of_week: days,
        preferred_time:
          preferredTime.length === 5 ? preferredTime + ":00" : preferredTime,
      });

      if (error) throw error;

      setTitle("");
      await fetchRoutines();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create routine");
    } finally {
      setCreating(false);
    }
  }

  async function onToggleActive(r: Routine) {
    setErr(null);
    setRoutines((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x)),
    );

    try {
      const { error } = await toggleRoutineActive(r.id, !r.is_active);
      if (error) throw error;
    } catch (e: any) {
      setRoutines((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, is_active: r.is_active } : x)),
      );
      setErr(e?.message ?? "Failed to update routine");
    }
  }

  async function onDelete(r: Routine) {
    setErr(null);
    setRoutines((prev) => prev.filter((x) => x.id !== r.id));

    try {
      const { error } = await removeRoutine(r.id);
      if (error) throw error;
    } catch (e: any) {
      await fetchRoutines();
      setErr(e?.message ?? "Failed to delete routine");
    }
  }

  if (loadingUser) {
    return <main className="p-6">Loading...</main>;
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Routines</h1>
            <p className="mt-1 text-sm text-gray-600">Logged in as: {email}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => router.push("/dashboard")}
              type="button"
            >
              Dashboard
            </button>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={fetchRoutines}
              type="button"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border p-4">
          <h2 className="font-semibold">Create routine</h2>

          <div className="mt-3 grid gap-3">
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Routine title (e.g., Vitamins, Gym, Reading)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-gray-600">Frequency</span>
                <select
                  className="w-full rounded-xl border px-3 py-2"
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as "daily" | "weekly")
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-gray-600">
                  Preferred time (required)
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  required
                />
              </label>
            </div>

            {frequency === "weekly" && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Days of week</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const active = daysOfWeek.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={
                          "rounded-full border px-3 py-1 text-sm " +
                          (active ? "bg-black text-white" : "")
                        }
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Pick at least one day for weekly routines.
                </p>
              </div>
            )}

            <button
              className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-60"
              disabled={!canCreate || creating}
              onClick={onCreate}
              type="button"
            >
              {creating ? "Creating..." : "Create routine"}
            </button>
          </div>
        </section>

        {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

        <section className="mt-6 rounded-2xl border p-4">
          <h2 className="font-semibold">Your routines</h2>

          {routines.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              No routines yet. Create your first one above.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {routines.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p
                      className={
                        "font-medium break-words " +
                        (!r.is_active ? "text-gray-500 line-through" : "")
                      }
                    >
                      {r.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.frequency} •{" "}
                      {r.preferred_time ? r.preferred_time.slice(0, 5) : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => onToggleActive(r)}
                      type="button"
                    >
                      {r.is_active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => onDelete(r)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
