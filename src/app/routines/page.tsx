"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { RoutineForm } from "@/components/routines/RoutineForm";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  Pill,
  SectionHeading,
} from "@/components/ui";
import {
  addRoutine,
  listRoutines,
  removeRoutine,
  toggleRoutineActive,
  updateRoutine,
} from "@/lib/db/routines";
import { getErrorMessage } from "@/lib/errors";
import {
  describeRoutine,
  formatPreferredTimeForDatabase,
  getDefaultRoutineFormValues,
  routineToFormValues,
} from "@/lib/routineSchedule";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { Routine, RoutineFormValues } from "@/types/routine";

export default function RoutinesPage() {
  const router = useRouter();

  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [savingMode, setSavingMode] = useState<"create" | "edit" | null>(null);
  const [createFormVersion, setCreateFormVersion] = useState(0);

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
    setLoadingRoutines(true);

    try {
      setRoutines(await listRoutines());
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load routines"));
    } finally {
      setLoadingRoutines(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    fetchRoutines();
  }, [userId]);

  async function onCreate(values: RoutineFormValues) {
    if (!userId) return;

    setSavingMode("create");
    setErr(null);

    try {
      await addRoutine({
        user_id: userId,
        title: values.title,
        frequency: values.frequency,
        days_of_week: values.frequency === "weekly" ? values.daysOfWeek : null,
        preferred_time: formatPreferredTimeForDatabase(values.preferredTime),
      });

      await fetchRoutines();
      setCreateFormVersion((current) => current + 1);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to create routine"));
    } finally {
      setSavingMode(null);
    }
  }

  async function onSaveEdit(values: RoutineFormValues) {
    if (!editingRoutine) return;

    setSavingMode("edit");
    setErr(null);

    try {
      await updateRoutine(editingRoutine.id, {
        title: values.title,
        frequency: values.frequency,
        days_of_week: values.frequency === "weekly" ? values.daysOfWeek : null,
        preferred_time: formatPreferredTimeForDatabase(values.preferredTime),
      });

      await fetchRoutines();
      setEditingRoutine(null);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to update routine"));
    } finally {
      setSavingMode(null);
    }
  }

  function startEditing(routine: Routine) {
    setEditingRoutine(routine);
    setErr(null);

    window.requestAnimationFrame(() => {
      document
        .getElementById("routine-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

    if (editingRoutine?.id === routine.id) {
      setEditingRoutine(null);
    }

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

  const isEditing = editingRoutine !== null;
  const formValues = editingRoutine
    ? routineToFormValues(editingRoutine)
    : getDefaultRoutineFormValues();
  const activeRoutineCount = routines.filter(
    (routine) => routine.is_active,
  ).length;

  return (
    <PageShell>
      <AppNav />

      <PageHeader
        eyebrow="Routine library"
        title="Build the rhythm you want."
        description="Keep routines simple and forgiving. Pause them when life changes; edit them when your rhythm changes."
      />

      {err && (
        <div className="mt-6">
          <ErrorNotice>{err}</ErrorNotice>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(310px,0.8fr)_minmax(0,1.3fr)]">
        <Card
          id="routine-editor"
          className="self-start scroll-mt-6 lg:sticky lg:top-8"
          tone={isEditing ? "accent" : "default"}
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <SectionHeading
              title={isEditing ? "Edit routine" : "Create a routine"}
              description={
                isEditing
                  ? `Update ${editingRoutine.title}'s rhythm without losing the routine.`
                  : "Give it a name, rhythm, and a preferred time."
              }
            />
            {isEditing && <Pill>Editing</Pill>}
          </div>

          <RoutineForm
            key={
              editingRoutine
                ? `edit-${editingRoutine.id}`
                : `create-${createFormVersion}`
            }
            initialValues={formValues}
            submitLabel={isEditing ? "Save changes" : "Create routine"}
            submittingLabel={isEditing ? "Saving…" : "Creating…"}
            isSubmitting={savingMode !== null}
            onSubmit={isEditing ? onSaveEdit : onCreate}
            onCancel={isEditing ? () => setEditingRoutine(null) : undefined}
          />
        </Card>

        <Card className="self-start">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              title="Your routines"
              description="A small library you can adjust as your week changes."
            />
            <div className="flex gap-2">
              <Pill>{activeRoutineCount} active</Pill>
              <Pill muted>{routines.length} total</Pill>
            </div>
          </div>

          {loadingRoutines ? (
            <p className="mt-5 text-sm text-muted">Loading routines…</p>
          ) : routines.length === 0 ? (
            <div className="mt-5">
              <EmptyState>
                No routines yet. Your first one can be something tiny.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {routines.map((routine) => {
                const selectedForEditing = editingRoutine?.id === routine.id;

                return (
                  <li
                    key={routine.id}
                    className={`rounded-2xl border px-4 py-4 transition ${
                      selectedForEditing
                        ? "border-primary/40 bg-primary-soft/70"
                        : routine.is_active
                          ? "border-border bg-surface-soft/65 hover:border-border-strong"
                          : "border-border bg-surface-soft/40"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                            routine.is_active ? "bg-primary" : "bg-border-strong"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`wrap-break-word font-medium ${
                                routine.is_active
                                  ? "text-foreground"
                                  : "text-muted line-through"
                              }`}
                            >
                              {routine.title}
                            </p>
                            <Pill muted>
                              {routine.frequency === "daily" ? "Daily" : "Weekly"}
                            </Pill>
                            {!routine.is_active && <Pill muted>Paused</Pill>}
                            {selectedForEditing && <Pill>Editing</Pill>}
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-muted">
                            {describeRoutine(routine)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <Button
                          className="min-h-8 px-3 py-1"
                          onClick={() => startEditing(routine)}
                          disabled={savingMode !== null}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-8 px-3 py-1"
                          onClick={() => onToggleActive(routine)}
                          disabled={savingMode !== null}
                        >
                          {routine.is_active ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          variant="danger"
                          className="min-h-8 px-3 py-1"
                          onClick={() => onDelete(routine)}
                          disabled={savingMode !== null}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
