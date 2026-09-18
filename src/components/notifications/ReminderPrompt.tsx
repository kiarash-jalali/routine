"use client";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/preferences/LanguageProvider";
import { ReminderSetup } from "./ReminderSetup";
export function ReminderPrompt({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Sheet open={open} onClose={onClose} title={t("reminder.title")}>
      <div className="mt-5">
        <ReminderSetup userId={userId} onDone={onClose} />
        <Button className="mt-4" variant="ghost" onClick={onClose}>
          {t("common.skip")}
        </Button>
      </div>
    </Sheet>
  );
}
