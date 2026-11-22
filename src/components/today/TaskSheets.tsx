"use client";
import { useState } from "react";
import { Collapse } from "@/components/Motion";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Sheet } from "@/components/Sheet";
import { TaskScheduleFields } from "@/components/tasks/TaskScheduleFields";
import { Button, ErrorNotice, Input } from "@/components/ui";
import { addTask, removeTask } from "@/lib/db/tasks";
import { getErrorMessage } from "@/lib/errors";
import { sortTasks } from "./taskFormat";
import { useTodayContext } from "./TodayContext";

export function TaskSheets() {
  const { t } = useLanguage();
  const {
    userId,
    setTasks,
    setTaskFilter: setFilter,
    showMoment,
    showTaskForm,
    setShowTaskForm,
    deleteTarget,
    setDeleteTarget,
    formError,
    setFormError,
  } = useTodayContext();
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [dueLocal, setDueLocal] = useState("");
  const [dueHasTime, setDueHasTime] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setTitleTouched(true);
    if (!userId || !title.trim() || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      const created = await addTask({
        user_id: userId,
        title: title.trim(),
        due_at: dueLocal ? new Date(dueLocal).toISOString() : null,
        due_has_time: dueHasTime,
      });
      setTasks((current) => sortTasks([...current, created]));
      setTitle("");
      setTitleTouched(false);
      setDueLocal("");
      setDueHasTime(false);
      setShowTaskForm(false);
      setFilter("all");
      showMoment("task_added", "add-task", "plus");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, t("task.addError")));
    } finally {
      setCreating(false);
    }
  }

  function closeTaskForm() {
    if (creating) return;
    setShowTaskForm(false);
    setTitle("");
    setTitleTouched(false);
    setDueLocal("");
    setDueHasTime(false);
    setFormError(null);
  }

  async function deleteTask() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setFormError(null);
    try {
      await removeTask(deleteTarget.id);
      setTasks((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      showMoment("task_deleted", undefined, "trash");
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, t("task.deleteError")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet
        open={showTaskForm}
        onClose={closeTaskForm}
        busy={creating}
        title={t("product.newTask")}
        description={t("product.newTaskBody")}
      >
        <form onSubmit={createTask} className="mt-6 space-y-5">
          <label className="grid gap-2 text-sm font-medium">
            {t("product.task")}
            <Input
              placeholder={t("product.taskPlaceholder")}
              value={title}
              invalid={titleTouched && !title.trim()}
              describedBy={
                titleTouched && !title.trim() ? "task-title-error" : undefined
              }
              onBlur={() => setTitleTouched(true)}
              onChange={(event) => setTitle(event.target.value)}
              required
              disabled={creating}
            />
            {titleTouched && !title.trim() && (
              <span id="task-title-error" className="field-error">
                {t("form.required")}
              </span>
            )}
          </label>
          <TaskScheduleFields
            value={dueLocal}
            hasTime={dueHasTime}
            onChange={(value, hasTime) => {
              setDueLocal(value);
              setDueHasTime(hasTime);
            }}
            disabled={creating}
          />
          <Collapse show={!!formError}>
            <ErrorNotice>{formError}</ErrorNotice>
          </Collapse>
          <div className="form-actions-sticky flex gap-3">
            <Button onClick={closeTaskForm} disabled={creating}>
              {t("common.cancel")}
            </Button>
            <Button
              className="moment-shine flex-1"
              variant="primary"
              type="submit"
              disabled={creating || !title.trim()}
              busy={creating}
            >
              {creating ? t("common.saving") : t("product.addTask")}
            </Button>
          </div>
        </form>
      </Sheet>
      <Sheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("task.deleteTitle")}
        description={
          deleteTarget
            ? t("task.deleteBody", { name: deleteTarget.title })
            : undefined
        }
        busy={deleting}
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
            disabled={deleting}
          >
            {t("product.keepTask")}
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={deleteTask}
            disabled={deleting}
            busy={deleting}
          >
            {t("task.deleteAction")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
