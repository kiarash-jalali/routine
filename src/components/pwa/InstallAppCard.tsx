"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { Button, Card, SectionHeading } from "@/components/ui";
import { iosPushRequiresInstall } from "@/lib/notifications";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;

  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function InstallAppCard() {
  const { t } = useLanguage();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [iosInstructions] = useState(iosPushRequiresInstall);

  useEffect(() => {

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!promptEvent && !iosInstructions)) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  }

  return (
    <Card tone="soft">
      <SectionHeading
        title={t("install.title")}
        description={t(
          iosInstructions ? "install.iosBody" : "install.body",
        )}
      />
      {promptEvent && (
        <Button className="mt-5" variant="primary" onClick={() => void install()}>
          <Icon name="plus" size={17} />
          {t("install.action")}
        </Button>
      )}
    </Card>
  );
}
