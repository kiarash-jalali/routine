"use client";

import { FormEvent, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  Button,
  Card,
  CheckCircle,
  Input,
  PageHeader,
  PageShell,
  SectionHeading,
  Stat,
} from "@/components/ui";

type DemoItem = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
};

const initialRoutines: DemoItem[] = [
  { id: "water", title: "Morning water", detail: "Every day · 08:00", done: true },
  { id: "walk", title: "20 minute walk", detail: "Every day · 18:30", done: false },
  { id: "read", title: "Read for 15 minutes", detail: "Every day · Anytime", done: false },
];

const initialTasks: DemoItem[] = [
  { id: "portfolio", title: "Review portfolio notes", detail: "Today", done: false },
  { id: "groceries", title: "Pick up groceries", detail: "Today · 17:00", done: true },
];

const demoCopy = {
  title: "Rootine demo",
  note: "Local sample data · no account required",
  reset: "Reset",
  add: "Add",
  progress: "DEMO PROGRESS",
  unsaved: "Nothing here is saved. Refresh or use Reset to start over.",
} as const;

export default function PortfolioDemoPage() {
  const [routines, setRoutines] = useState(initialRoutines);
  const [tasks, setTasks] = useState(initialTasks);
  const [taskTitle, setTaskTitle] = useState("");

  const completed = useMemo(
    () => [...routines, ...tasks].filter((item) => item.done).length,
    [routines, tasks],
  );
  const total = routines.length + tasks.length;
  const openTasks = tasks.filter((item) => !item.done).length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  function toggle(
    kind: "routine" | "task",
    id: string,
  ) {
    const update = (items: DemoItem[]) =>
      items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      );

    if (kind === "routine") setRoutines(update);
    else setTasks(update);
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;

    setTasks((current) => [
      ...current,
      {
        id: `demo-${Date.now()}`,
        title,
        detail: "Today · Demo task",
        done: false,
      },
    ]);
    setTaskTitle("");
  }

  function resetDemo() {
    setRoutines(initialRoutines);
    setTasks(initialTasks);
    setTaskTitle("");
  }

  return (
    <PageShell className="max-w-4xl py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/75 px-4 py-3 text-sm text-muted shadow-card backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="icon-tile !h-9 !w-9 !rounded-xl">
            <Icon name="rootine" size={18} />
          </span>
          <span>
            <strong className="block text-foreground">{demoCopy.title}</strong>
            <span className="text-xs">{demoCopy.note}</span>
          </span>
        </span>
        <Button size="sm" variant="ghost" onClick={resetDemo}>
          <Icon name="history" size={16} />
          {demoCopy.reset}
        </Button>
      </div>

      <PageHeader
        eyebrow="A sample day"
        title="Today"
        description="Try the controls. This demo uses Rootine's real interface components with temporary local data."
      />

      <div className="stats-strip mb-6 grid grid-cols-3 divide-x divide-border rounded-2xl px-2 py-5 sm:px-5">
        <div className="px-3 sm:px-5">
          <Stat value={routines.length} label="routines today" />
        </div>
        <div className="px-3 sm:px-5">
          <Stat value={openTasks} label="open tasks" />
        </div>
        <div className="px-3 sm:px-5">
          <Stat value={`${progress}%`} label="day complete" />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Routines"
            description="Mark a routine complete and the day stats update immediately."
          />
          <ul className="mt-5">
            {routines.map((routine) => (
              <li
                className={`list-row ${routine.done ? "is-done" : ""}`}
                key={routine.id}
              >
                <button
                  type="button"
                  className="check-control -ms-2"
                  aria-pressed={routine.done}
                  aria-label={
                    routine.done
                      ? `Reopen ${routine.title}`
                      : `Complete ${routine.title}`
                  }
                  onClick={() => toggle("routine", routine.id)}
                >
                  <CheckCircle checked={routine.done} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="row-title">{routine.title}</p>
                  <p className="row-detail">{routine.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading
            title="Tasks"
            description="Add a temporary task or check off the ones already here."
          />

          <form className="mt-5 flex gap-2" onSubmit={addTask}>
            <Input
              size="sm"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Add a demo task"
              aria-label="Demo task title"
            />
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={!taskTitle.trim()}
              aria-label="Add demo task"
            >
              <Icon name="plus" size={17} />
              {demoCopy.add}
            </Button>
          </form>

          <ul className="mt-4">
            {tasks.map((task) => (
              <li
                className={`list-row ${task.done ? "is-done" : ""}`}
                key={task.id}
              >
                <button
                  type="button"
                  className="check-control -ms-2"
                  aria-pressed={task.done}
                  aria-label={
                    task.done ? `Reopen ${task.title}` : `Complete ${task.title}`
                  }
                  onClick={() => toggle("task", task.id)}
                >
                  <CheckCircle checked={task.done} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="row-title">{task.title}</p>
                  <p className="row-detail">{task.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card tone="accent" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="page-eyebrow">{demoCopy.progress}</p>
            <p className="display-title text-2xl">
              {completed === total
                ? "Everything is done."
                : `${completed} of ${total} items complete`}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {demoCopy.unsaved}
            </p>
          </div>
          <span className="success-mark" aria-hidden="true">
            <Icon name={completed === total ? "check" : "spark"} size={24} />
          </span>
        </div>
      </Card>
    </PageShell>
  );
}
