"use client";

import { Icon, type IconName } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, PageHeader, PageShell } from "@/components/ui";
import { Link } from "next-view-transitions";
import type { TranslationKey } from "@/lib/i18n";

type GuideItem = {
  title: TranslationKey;
  body: TranslationKey;
  icon: IconName;
};

type GuideSection = {
  title: TranslationKey;
  body: TranslationKey;
  items: readonly GuideItem[];
};

const sections = [
  {
    title: "intro.welcome",
    body: "intro.welcomeBody",
    items: [
      { title: "intro.task", body: "intro.taskBody", icon: "today" },
      { title: "intro.routine", body: "intro.routineBody", icon: "routines" },
    ],
  },
  {
    title: "intro.checkin",
    body: "intro.checkinBody",
    items: [
      { title: "intro.rhythm", body: "intro.rhythmBody", icon: "rootine" },
      { title: "intro.points", body: "intro.pointsBody", icon: "spark" },
    ],
  },
  {
    title: "intro.perspective",
    body: "intro.perspectiveBody",
    items: [
      { title: "intro.history", body: "intro.historyBody", icon: "history" },
      { title: "intro.reminders", body: "intro.remindersBody", icon: "clock" },
    ],
  },
  {
    title: "intro.life",
    body: "intro.lifeBody",
    items: [
      { title: "intro.health", body: "intro.healthBody", icon: "checkin" },
      { title: "intro.workout", body: "intro.workoutBody", icon: "sun" },
    ],
  },
  {
    title: "guide.installTitle",
    body: "guide.installBody",
    items: [
      {
        title: "guide.installIos",
        body: "guide.installIosBody",
        icon: "plus",
      },
      {
        title: "guide.installBrowser",
        body: "guide.installBrowserBody",
        icon: "settings",
      },
    ],
  },
] as const satisfies readonly GuideSection[];

export default function GuidePage() {
  const { t } = useLanguage();

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow={t("settings.guide")}
        title={t("guide.title")}
        description={t("guide.body")}
      />
      <div className="mb-6">
        <Link href="/onboarding?replay=1" className="btn btn-secondary inline-flex">
          <Icon name="history" size={17} />
          {t("guide.replay")}
        </Link>
      </div>
      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <h2 className="display-title text-2xl">{t(section.title)}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t(section.body)}
            </p>
            <div className="intro-illustration">
              {section.items.map((item) => (
                <div key={item.title} className="intro-example">
                  <span className="icon-tile">
                    <Icon name={item.icon} />
                  </span>
                  <div>
                    <h3 className="font-semibold">{t(item.title)}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {t(item.body)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
