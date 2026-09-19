"use client";
import { useLanguage } from "@/components/preferences/LanguageProvider";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  MomentPopup,
  MomentSource,
  type MomentNotice,
} from "@/components/MomentPopup";
import { Sheet } from "@/components/Sheet";
import {
  AnimatedList,
  AnimatedListItem,
  AnimatedNumber,
} from "@/components/Motion";
import { RoutineForm } from "@/components/routines/RoutineForm";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  Pill,
  SegmentedControl,
} from "@/components/ui";
import {
  addRoutine,
  removeRoutine,
  toggleRoutineActive,
  updateRoutine,
} from "@/lib/db/routines";
import { getErrorMessage } from "@/lib/errors";
import { getMomentCopy, type MomentCopyKey } from "@/lib/moments";
import {
  describeRoutine,
  formatPreferredTimeForDatabase,
  getDefaultRoutineFormValues,
  routineToFormValues,
} from "@/lib/routineSchedule";
import type { Routine, RoutineFormValues } from "@/types/routine";

export function RoutinesClient({
  userId,
  initialRoutines,
  initialLoadError,
}: {
  userId: string;
  initialRoutines: Routine[];
  initialLoadError: boolean;
}) {
  const { t } = useLanguage();
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [error, setError] = useState<string | null>(
    initialLoadError ? t("routine.loadError") : null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [moment, setMoment] = useState<MomentNotice | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());

  function showMoment(
    key: MomentCopyKey,
    sourceId?: string,
    icon: MomentNotice["icon"] = "spark",
  ) {
    const copy = getMomentCopy(key);
    setMoment({
      id: `${key}-${Date.now()}`,
      ...copy,
      sourceId,
      icon,
      tone: "success",
    });
  }

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
      const wasEditing = Boolean(editingRoutine);
      if (editingRoutine) {
        const updated = await updateRoutine(editingRoutine.id, changes);
        setRoutines((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const created = await addRoutine({ user_id: userId, ...changes });
        setRoutines((current) => [created, ...current]);
      }
      setEditorOpen(false);
      showMoment(
        wasEditing ? "routine_updated" : "routine_added",
        wasEditing ? undefined : "add-routine",
        wasEditing ? "edit" : "plus",
      );
      if (!wasEditing) setFilter("all");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, t("routine.saveError")));
    } finally {
      setSaving(false);
    }
  }

  function openEditor(routine: Routine | null) {
    setEditorVersion((version) => version + 1);
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
      showMoment(
        routine.is_active ? "routine_paused" : "routine_resumed",
        `routine-toggle-${routine.id}`,
        routine.is_active ? "pause" : "routines",
      );
    } catch (error: unknown) {
      setRoutines((current) =>
        current.map((item) =>
          item.id === routine.id
            ? { ...item, is_active: routine.is_active }
            : item,
        ),
      );
      setError(getErrorMessage(error, t("routine.updateError")));
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
      showMoment("routine_deleted", undefined, "trash");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, t("routine.deleteError")));
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
  return (
    <PageShell>
      <PageHeader
        eyebrow={t("routine.eyebrow")}
        title={t("nav.routines")}
        description={t("routine.description")}
        actions={
          <MomentSource id="add-routine">
            <Button
              className="moment-shine"
              variant="primary"
              onClick={() => openEditor(null)}
              disabled={!userId}
            >
              <Icon name="plus" size={18} />
              {t("routine.new")}
            </Button>
          </MomentSource>
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
          label={t("routine.filter")}
          options={[
            { value: "all", label: t("common.all") },
            { value: "active", label: t("common.active") },
            { value: "paused", label: t("common.paused") },
          ]}
        />
        <span className="text-sm text-muted">
          <AnimatedNumber value={activeCount} /> active ·{" "}
          <AnimatedNumber value={routines.length} /> total
        </span>
      </div>
      <Card>
        <AnimatedList>
          {visible.length === 0 ? (
            <AnimatedListItem key="empty">
              <EmptyState>
                {filter === "paused"
                  ? t("routine.emptyPaused")
                  : filter === "active"
                    ? t("routine.emptyActive")
                    : t("routine.empty")}
                {routines.length === 0 && (
                  <div className="mt-4">
                    <Button
                      className="moment-shine"
                      onClick={() => openEditor(null)}
                      disabled={!userId}
                    >
                      <Icon name="plus" size={16} />
                      {t("routine.first")}
                    </Button>
                  </div>
                )}
              </EmptyState>
            </AnimatedListItem>
          ) : (
            visible.map((routine) => (
              <AnimatedListItem
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
                    {routine.is_active
                      ? t("common.active")
                      : t("common.paused")}
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
                    <span>{t("common.edit")}</span>
                  </Button>
                  <MomentSource id={`routine-toggle-${routine.id}`}>
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
                  </MomentSource>
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
              </AnimatedListItem>
            ))
          )}
        </AnimatedList>
      </Card>

      <MomentPopup notice={moment} onDismiss={() => setMoment(null)} />

      <Sheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        busy={saving}
        title={editingRoutine ? t("routine.edit") : t("routine.new")}
        description={t("routine.formBody")}
      >
        <RoutineForm
          key={`${editingRoutine?.id ?? "new"}-${editorVersion}`}
          initialValues={
            editingRoutine
              ? routineToFormValues(editingRoutine)
              : getDefaultRoutineFormValues()
          }
          submitLabel={
            editingRoutine ? t("product.saveChanges") : t("routine.create")
          }
          submittingLabel={t("common.saving")}
          isSubmitting={saving}
          onSubmit={saveRoutine}
          onCancel={() => setEditorOpen(false)}
          shineSubmit={!editingRoutine}
        />
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
        title={t("routine.delete")}
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be removed. You can pause it instead if you only need a break.`
            : undefined
        }
        keyboardAssist={false}
        compact
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
            {t("routine.keep")}
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
