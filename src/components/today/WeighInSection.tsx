"use client";
import { useState } from "react";
import { Link } from "next-view-transitions";
import { Icon } from "@/components/Icon";
import { NumberField, RANGES, readNumber } from "@/components/body/fields";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, Card, ErrorNotice, SectionHeading } from "@/components/ui";
import { useTodayContext } from "./TodayContext";

/**
 * Compact weigh-in: shown only to people with a body profile, until today's
 * weight is saved or the card is dismissed for the day. The waist field
 * appears only on the user's week start day.
 */
export function WeighInSection() {
  const { t } = useLanguage();
  const { weighIn } = useTodayContext();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [submitted, setSubmitted] = useState(false);
  if (!weighIn.visible) return null;

  const weightValue = readNumber(weight, RANGES.weight);
  const waistValue = readNumber(waist, RANGES.waist);

  return (
    <Card>
      <SectionHeading
        title={t("dashboard.weighIn")}
        description={t(weighIn.askWaist ? "dashboard.weighInWaist" : "dashboard.weighInBody")}
        action={
          <Link className="inline-flex min-h-8 items-center gap-1 text-sm text-primary" href="/body">
            {t("dashboard.weighInOpen")}
            <Icon name="chevron" size={15} />
          </Link>
        }
      />
      <form
        noValidate
        className="mt-4 flex flex-wrap items-start gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitted(true);
          if (typeof weightValue !== "number" || waistValue === "invalid") return;
          const saved = await weighIn.save(weightValue, waistValue);
          if (saved) {
            setWeight("");
            setWaist("");
            setSubmitted(false);
          }
        }}
      >
        <div className="min-w-0 flex-1 basis-36">
          <NumberField
            label={t("body.weight")}
            value={weight}
            onChange={setWeight}
            range={RANGES.weight}
            showError={submitted}
            required
          />
        </div>
        {weighIn.askWaist && (
          <div className="min-w-0 flex-1 basis-36">
            <NumberField
              label={t("body.waist")}
              value={waist}
              onChange={setWaist}
              range={RANGES.waist}
              showError={submitted}
            />
          </div>
        )}
        <div className="flex w-full gap-2">
          <Button type="submit" variant="primary" busy={weighIn.saving} disabled={weighIn.saving}>
            {t("common.save")}
          </Button>
          <Button variant="ghost" disabled={weighIn.saving} onClick={weighIn.dismiss}>
            {t("dashboard.weighInLater")}
          </Button>
        </div>
      </form>
      {weighIn.failed && (
        <div className="mt-3">
          <ErrorNotice>{t("common.error")}</ErrorNotice>
        </div>
      )}
    </Card>
  );
}
