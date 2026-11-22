"use client";
import { createContext, useContext } from "react";
import type { TodayState } from "./useTodayState";

export const TodayContext = createContext<TodayState | null>(null);

export function useTodayContext(): TodayState {
  const value = useContext(TodayContext);
  if (!value) throw new Error("useTodayContext must be used inside TodayContext");
  return value;
}
