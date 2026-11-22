"use client";

import { useEffect, useState } from "react";
import { AnimatedList, AnimatedListItem } from "@/components/Motion";
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  SectionHeading,
} from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { useOwnedData } from "@/components/life/useOwnedData";
import { BodyMetrics } from "@/components/body/BodyMetrics";
import { BodySetup } from "@/components/body/BodySetup";
import { MeasurementForm } from "@/components/body/MeasurementForm";
import { ProfileForm } from "@/components/body/ProfileForm";
import { WeightChart } from "@/components/body/WeightChart";
import {
  deleteMeasurement,
  loadBody,
  replaceMeasurement,
  saveBodyProfile,
  saveMeasurement,
} from "@/lib/db/body";
import { getLocalDateKey } from "@/lib/today";
import { useToday } from "@/lib/useToday";
import type { BodyMeasurement, MeasurementInput } from "@/types/body";

type BodyData = Awaited<ReturnType<typeof loadBody>>;

// Stable loader for useOwnedData: always reads up to the device's today.
const loadBodyToday = (userId: string) => loadBody(userId, getLocalDateKey());

export function BodyClient({
  userId,
  serverDay,
  initialData,
  initialLoadError,
}: {
  userId: string;
  serverDay: string;
  initialData: BodyData;
  initialLoadError: boolean;
}) {
  const { t, date, locale } = useLanguage();
  const { data, error, busy, act } = useOwnedData(
    loadBodyToday,
    userId,
    initialData,
    initialLoadError,
  );
  const clientDay = getLocalDateKey(useToday());
  // Render the server's day first so hydration matches, then follow the device.
  const [today, setToday] = useState(serverDay);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device day is only known after hydration
    setToday(clientDay);
  }, [clientDay]);

  const [editor, setEditor] = useState<BodyMeasurement | "new" | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurement | null>(null);
  const [dayTaken, setDayTaken] = useState(false);
  const fmt = (value: number, digits = 1) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const { profile, measurements } = data;

  if (!profile) {
    return (
      <PageShell>
        <PageHeader title={t("body.title")} description={t("body.description")} />
        <BodySetup
          today={today}
          busy={busy}
          error={error}
          onFinish={async (values, measurement) => {
            await act(async () => {
              await saveBodyProfile(userId, values);
              if (measurement) await saveMeasurement(userId, measurement);
            });
          }}
        />
        <p className="mx-auto mt-6 max-w-xl text-xs leading-5 text-muted">
          {t("body.notAdvice")}
        </p>
      </PageShell>
    );
  }

  const points = measurements
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ day: m.measured_on, weightKg: Number(m.weight_kg) }));

  async function saveEntry(values: MeasurementInput) {
    const current = editor;
    const movingOnto =
      current &&
      current !== "new" &&
      current.measured_on !== values.measured_on &&
      measurements.some((m) => m.measured_on === values.measured_on);
    setDayTaken(Boolean(movingOnto));
    if (movingOnto) return;
    const ok = await act(async () => {
      if (current && current !== "new" && current.measured_on !== values.measured_on) {
        await replaceMeasurement(userId, current.id, {
          measured_on: values.measured_on,
          weight_kg: values.weight_kg ?? null,
          waist_cm: values.waist_cm ?? null,
          body_fat_pct: values.body_fat_pct ?? null,
          note: values.note ?? null,
        });
      } else {
        await saveMeasurement(userId, values);
      }
    });
    if (ok) setEditor(null);
  }

  return (
    <PageShell>
      <PageHeader
        title={t("body.title")}
        description={t("body.description")}
        actions={
          <>
            <Button onClick={() => setEditingProfile(true)}>{t("body.editProfile")}</Button>
            <Button variant="primary" onClick={() => setEditor("new")}>
              {t("body.add")}
            </Button>
          </>
        }
      />
      {error && (
        <div className="mb-5">
          <ErrorNotice>{t("common.error")}</ErrorNotice>
        </div>
      )}

      <SectionHeading title={t("body.metrics")} />
      <div className="mt-4">
        <BodyMetrics profile={profile} measurements={measurements} today={today} />
      </div>

      <Card className="mt-9">
        <WeightChart points={points} today={today} weekStartsOn={profile.week_starts_on} />
      </Card>

      <div className="mt-9">
        <SectionHeading title={t("body.history")} />
        {measurements.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              action={
                <Button variant="primary" onClick={() => setEditor("new")}>
                  {t("body.add")}
                </Button>
              }
            >
              {t("body.historyEmpty")}
            </EmptyState>
          </div>
        ) : (
          <AnimatedList className="mt-4">
            {measurements.map((m) => (
              <AnimatedListItem key={m.id} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="row-title">{date(m.measured_on)}</p>
                  <p className="row-detail">
                    {[
                      m.weight_kg !== null && t("body.kgValue", { value: fmt(Number(m.weight_kg), 2) }),
                      m.waist_cm !== null && t("body.cmValue", { value: fmt(Number(m.waist_cm)) }),
                      m.body_fat_pct !== null && t("body.pctValue", { value: fmt(Number(m.body_fat_pct)) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {m.note && (
                    <p className="row-detail whitespace-pre-wrap">
                      <bdi>{m.note}</bdi>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-label={`${t("common.edit")}: ${date(m.measured_on)}`}
                    onClick={() => setEditor(m)}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`${t("common.delete")}: ${date(m.measured_on)}`}
                    onClick={() => setDeleteTarget(m)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </AnimatedListItem>
            ))}
          </AnimatedList>
        )}
      </div>

      <p className="mt-9 text-xs leading-5 text-muted">{t("body.notAdvice")}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{t("body.privacy")}</p>

      <Sheet
        open={editor !== null}
        onClose={() => {
          setEditor(null);
          setDayTaken(false);
        }}
        busy={busy}
        title={t(editor === "new" ? "body.add" : "body.editMeasurement")}
      >
        {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
        {dayTaken && <ErrorNotice>{t("body.dayTaken")}</ErrorNotice>}
        {editor && (
          <MeasurementForm
            key={editor === "new" ? "new" : editor.id}
            initial={editor === "new" ? undefined : editor}
            today={today}
            busy={busy}
            onCancel={() => {
              setEditor(null);
              setDayTaken(false);
            }}
            onSave={saveEntry}
          />
        )}
      </Sheet>

      <Sheet
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        busy={busy}
        title={t("body.editProfile")}
      >
        {error && <ErrorNotice>{t("common.error")}</ErrorNotice>}
        {editingProfile && (
          <ProfileForm
            profile={profile}
            busy={busy}
            onCancel={() => setEditingProfile(false)}
            onSave={async (values) => {
              const ok = await act(() => saveBodyProfile(userId, values));
              if (ok) setEditingProfile(false);
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
        keyboardAssist={false}
        compact
        title={t("body.deleteTitle")}
        description={
          deleteTarget ? t("body.deleteBody", { date: date(deleteTarget.measured_on) }) : undefined
        }
      >
        {error && (
          <div className="mt-4">
            <ErrorNotice>{t("common.error")}</ErrorNotice>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => setDeleteTarget(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            busy={busy}
            disabled={busy}
            onClick={async () => {
              const target = deleteTarget;
              if (!target) return;
              const ok = await act(() => deleteMeasurement(userId, target.id));
              if (ok) setDeleteTarget(null);
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
