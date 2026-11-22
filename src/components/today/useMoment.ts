"use client";
import { useState } from "react";
import type { MomentNotice } from "@/components/MomentPopup";
import { getMomentCopy, type MomentCopyKey } from "@/lib/moments";

export function useMoment() {
  const [moment, setMoment] = useState<MomentNotice | null>(null);

  function showMoment(
    key: MomentCopyKey,
    sourceId?: string,
    icon: MomentNotice["icon"] = "spark",
  ) {
    const copy = getMomentCopy(key);
    setMoment({
      // Called from event handlers only, never during render.
      id: `${key}-${Date.now()}`,
      ...copy,
      sourceId,
      icon,
      tone: "success",
    });
  }

  return { moment, setMoment, showMoment };
}
