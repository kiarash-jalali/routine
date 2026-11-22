"use client";
import { Icon } from "@/components/Icon";
import { MomentSource } from "@/components/MomentPopup";
import { AnimatedList, AnimatedListItem } from "@/components/Motion";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import {
  Button,
  Card,
  CheckCircle,
  EmptyState,
  SectionHeading,
  SegmentedControl,
} from "@/components/ui";
import { checkinItemKey } from "@/lib/checkinProgress";
import { formatDueTime } from "./taskFormat";
import { useTodayContext } from "./TodayContext";

export function TasksSection() {
  const { t, locale } = useLanguage();
  const {
    tasks,
    todayTasks,
    today,
    pendingIds,
    toggleDone,
    openTaskForm,
    requestDelete,
    taskFilter: filter,
    setTaskFilter: setFilter,
  } = useTodayContext();
  const visibleTasks =
    filter === "today"
      ? todayTasks
      : filter === "done"
        ? tasks.filter((task) => task.is_done)
        : tasks;

  return (
    <Card>
      <SectionHeading
        title={t("product.tasks")}
        action={
          <button
            className="icon-button -me-2 -mt-2"
            aria-label={t("product.addTask")}
            onClick={openTaskForm}
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="mt-4 mb-6">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          label={t("task.filter")}
          options={[
            { value: "today", label: t("common.today") },
            { value: "all", label: t("common.all") },
            { value: "done", label: t("task.done") },
          ]}
        />
      </div>
      <AnimatedList>
        {visibleTasks.length === 0 ? (
          <AnimatedListItem key="empty">
            <EmptyState
              action={
                filter !== "done" ? (
                  <Button variant="primary" onClick={openTaskForm}>
                    <Icon name="plus" size={16} />
                    {t("product.addTask")}
                  </Button>
                ) : undefined
              }
            >
              {filter === "done"
                ? t("task.emptyDone")
                : filter === "all"
                  ? t("task.emptyAll")
                  : t("task.emptyToday")}
            </EmptyState>
          </AnimatedListItem>
        ) : (
          visibleTasks.map((task) => (
            <AnimatedListItem
              key={task.id}
              className={`list-row ${task.is_done ? "is-done" : ""}`}
            >
              <MomentSource id={`task-${task.id}`}>
                <button
                  className="check-control -ms-2"
                  aria-pressed={task.is_done}
                  aria-label={t(
                    task.is_done ? "task.reopenNamed" : "task.completeNamed",
                    { name: task.title },
                  )}
                  disabled={pendingIds.includes(checkinItemKey("task", task.id))}
                  onClick={() => toggleDone(task)}
                >
                  <CheckCircle checked={task.is_done} />
                </button>
              </MomentSource>
              <div className="min-w-0 flex-1">
                <p className="row-title">{task.title}</p>
                <p className="row-detail">
                {formatDueTime(task, locale, t("common.anytime"), today, {
                  today: t("common.today"),
                  tomorrow: t("common.tomorrow"),
                  yesterday: t("common.yesterday"),
                })}
              </p>
              </div>
              <button
                className="icon-button danger -me-2"
                aria-label={t("task.deleteNamed", { name: task.title })}
                disabled={pendingIds.includes(checkinItemKey("task", task.id))}
                onClick={() => requestDelete(task)}
              >
                <Icon name="trash" size={17} />
              </button>
            </AnimatedListItem>
          ))
        )}
      </AnimatedList>
    </Card>
  );
}
