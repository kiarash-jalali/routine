"use client";

import { Icon, type IconName } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Card, PageHeader, PageShell } from "@/components/ui";

const sections = [
  {
    title: "intro.welcome",
    body: "intro.welcomeBody",
    items: [
      { key: "task", icon: "today" },
      { key: "routine", icon: "routines" },
    ],
  },
  {
    title: "intro.checkin",
    body: "intro.checkinBody",
    items: [
      { key: "rhythm", icon: "rootine" },
      { key: "points", icon: "spark" },
    ],
  },
  {
    title: "intro.perspective",
    body: "intro.perspectiveBody",
    items: [
      { key: "history", icon: "history" },
      { key: "reminders", icon: "clock" },
    ],
  },
  {
    title: "intro.life",
    body: "intro.lifeBody",
    items: [
      { key: "health", icon: "checkin" },
      { key: "workout", icon: "sun" },
    ],
  },
] as const;

export default function GuidePage() {
  const { t } = useLanguage();

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow={t("settings.guide")}
        title={t("guide.title")}
        description={t("guide.body")}
      />
      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <h2 className="display-title text-2xl">{t(section.title)}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t(section.body)}
            </p>
            <div className="intro-illustration">
              {section.items.map((item) => (
                <div key={item.key} className="intro-example">
                  <span className="icon-tile">
                    <Icon name={item.icon as IconName} />
                  </span>
                  <div>
                    <h3 className="font-semibold">{t(`intro.${item.key}`)}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {t(`intro.${item.key}Body`)}
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
