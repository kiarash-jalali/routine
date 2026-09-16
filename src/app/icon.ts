import { routineIconResponse } from "@/lib/pwaIcon";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return routineIconResponse({ size: 64 });
}
