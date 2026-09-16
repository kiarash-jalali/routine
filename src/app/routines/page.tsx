"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { RoutineForm } from "@/components/routines/RoutineForm";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PageShell,
  Pill,
  SegmentedControl,
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
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [announcement, setAnnouncement] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabaseBrowser().auth.getUser();
        if (error || !data.user) {
          router.replace("/login");
          return;
        }
        const rows = await listRoutines();
        if (!cancelled) {
          setUserId(data.user.id);
          setRoutines(rows);
        }
      } catch (error: unknown) {
        if (!cancelled)
          setError(getErrorMessage(error, "Your routines couldn’t be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function saveRoutine(values: RoutineFormValues) {
    if (!userId || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const changes = {
        title: values.title,
        frequency: values.frequency,
        days_of_week: values.frequency === "weekly" ? values.daysOfWeek : null,
        preferred_time: formatPreferredTimeForDatabase(values.preferredTime),
      };
      if (editingRoutine) await updateRoutine(editingRoutine.id, changes);
      else await addRoutine({ user_id: userId, ...changes });
      setRoutines(await listRoutines());
      setEditorOpen(false);
      setAnnouncement(editingRoutine ? "Routine updated." : "Routine added.");
      if (!editingRoutine) setFilter("all");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Your routine couldn’t be saved."));
    } finally {
      setSaving(false);
    }
  }

  function openEditor(routine: Routine | null) {
    setEditingRoutine(routine);
    setFormError(null);
    setEditorOpen(true);
  }

  async function toggleActive(routine: Routine) {
    if (pending.current.has(routine.id)) return;
    pending.current.add(routine.id);
    setPendingIds([...pending.current]);
    setError(null);
    setRoutines((current) =>
      current.map((item) =>
        item.id === routine.id
          ? { ...item, is_active: !routine.is_active }
          : item,
      ),
    );
    try {
      await toggleRoutineActive(routine.id, !routine.is_active);
      setAnnouncement(
        routine.is_active
          ? "Routine paused. Resume whenever you’re ready."
          : "Routine resumed.",
      );
    } catch (error: unknown) {
      setRoutines((current) =>
        current.map((item) =>
          item.id === routine.id
            ? { ...item, is_active: routine.is_active }
            : item,
        ),
      );
      setError(getErrorMessage(error, "Your routine couldn’t be updated."));
    } finally {
      pending.current.delete(routine.id);
      setPendingIds([...pending.current]);
    }
  }

  async function deleteRoutine() {
    if (!deleteTarget || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await removeRoutine(deleteTarget.id);
      setRoutines((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setAnnouncement("Routine deleted.");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "Your routine couldn’t be deleted."));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = routines.filter((routine) => routine.is_active).length;
  const visible = routines.filter(
    (routine) =>
      filter === "all" ||
      (filter === "active" ? routine.is_active : !routine.is_active),
  );
  if (loading)
    return (
      <PageShell>
        <LoadingState label="Loading routines…" />
      </PageShell>
    );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Small things, repeated"
        title="Routines"
        description="A rhythm that fits your life. Adjust it as you go."
        actions={
          <Button
            variant="primary"
            onClick={() => openEditor(null)}
            disabled={!userId}
          >
            <Icon name="plus" size={18} />
            New routine
          </Button>
        }
      />
      {error && (
        <div className="mb-6">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          label="Routine filter"
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
          ]}
        />
        <span className="text-sm text-muted">
          {activeCount} active · {routines.length} total
        </span>
      </div>
      <Card>
        {visible.length === 0 ? (
          <EmptyState>
            {filter === "paused"
              ? "No paused routines."
              : filter === "active"
                ? "No active routines. Start again whenever you’re ready."
                : "Start small. A glass of water, a walk, a few pages."}
            {routines.length === 0 && (
              <div className="mt-4">
                <Button onClick={() => openEditor(null)} disabled={!userId}>
                  <Icon name="plus" size={16} />
                  Create your first routine
                </Button>
              </div>
            )}
          </EmptyState>
        ) : (
          <ul key={filter}>
            {visible.map((routine) => (
              <li
                key={routine.id}
                className="list-row flex-wrap sm:flex-nowrap"
              >
                <span
                  className={`icon-tile ${!routine.is_active ? "bg-surface-soft text-muted" : routine.preferred_time && routine.preferred_time < "12:00" ? "amber" : ""}`}
                >
                  <Icon
                    name={
                      !routine.is_active
                        ? "pause"
                        : routine.preferred_time &&
                            routine.preferred_time >= "17:00"
                          ? "moon"
                          : "sun"
                    }
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`row-title ${!routine.is_active ? "text-muted" : ""}`}
                  >
                    {routine.title}
                  </p>
                  <p className="row-detail">{describeRoutine(routine)}</p>
                </div>
                <div className="hidden sm:block">
                  <Pill muted={!routine.is_active}>
                    {routine.is_active ? "Active" : "Paused"}
                  </Pill>
                </div>
                <div className="flex w-full items-center justify-end gap-2 pl-14 sm:w-auto sm:pl-0">
                  <Button
                    variant="ghost"
                    onClick={() => openEditor(routine)}
                    disabled={pendingIds.includes(routine.id)}
                    aria-label={`Edit ${routine.title}`}
                  >
                    <Icon name="edit" size={16} />
                    <span>Edit</span>
                  </Button>
                  <span className="switch-target">
                    <button
                      className="switch"
                      type="button"
                      role="switch"
                      aria-checked={routine.is_active}
                      aria-label={`${routine.is_active ? "Pause" : "Resume"} ${routine.title}`}
                      onClick={() => toggleActive(routine)}
                      disabled={pendingIds.includes(routine.id)}
                    />
                  </span>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete ${routine.title}`}
                    disabled={pendingIds.includes(routine.id)}
                    onClick={() => {
                      setFormError(null);
                      setDeleteTarget(routine);
                    }}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-4 min-h-6 px-1 text-sm text-muted" role="status">
        {announcement || "Pause a routine whenever you need a little space."}
      </p>
      <Sheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        busy={saving}
        title={editingRoutine ? "Edit routine" : "A new routine"}
        description="Make it small enough to come back to."
      >
        {editorOpen && (
          <RoutineForm
            key={editingRoutine?.id ?? "new"}
            initialValues={
              editingRoutine
                ? routineToFormValues(editingRoutine)
                : getDefaultRoutineFormValues()
            }
            submitLabel={editingRoutine ? "Save changes" : "Create routine"}
            submittingLabel="Saving…"
            isSubmitting={saving}
            onSubmit={saveRoutine}
            onCancel={() => setEditorOpen(false)}
          />
        )}
        {formError && (
          <div className="mt-4">
            <ErrorNotice>{formError}</ErrorNotice>
          </div>
        )}
      </Sheet>
      <Sheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        busy={saving}
        title="Delete this routine?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed. You can pause it instead if you only need a break.`
            : undefined
        }
      >
        {formError && (
          <div className="mt-4">
            <ErrorNotice>{formError}</ErrorNotice>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1"
            onClick={() => setDeleteTarget(null)}
            disabled={saving}
          >
            Keep routine
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={deleteRoutine}
            disabled={saving}
            busy={saving}
          >
            Delete routine
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
