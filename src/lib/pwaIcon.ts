import { ImageResponse } from "next/og";
import { createElement } from "react";

type RoutineIconOptions = {
  size: number;
  maskable?: boolean;
};

export function routineIconResponse({
  size,
  maskable = false,
}: RoutineIconOptions): ImageResponse {
  const tileSize = Math.round(size * (maskable ? 0.54 : 0.72));
  const tileRadius = Math.round(tileSize * 0.27);
  const checkSize = Math.round(tileSize * 0.58);

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#286e5e" : "#f5f5ee",
        },
      },
      createElement(
        "div",
        {
          style: {
            width: tileSize,
            height: tileSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tileRadius,
            background: maskable ? "#f5f5ee" : "#286e5e",
            color: maskable ? "#286e5e" : "#ffffff",
            boxShadow: maskable
              ? "0 0 0 1px rgba(255,255,255,0.14)"
              : "0 10px 30px rgba(40,110,94,0.18)",
            fontFamily: "Arial, sans-serif",
            fontSize: checkSize,
            fontWeight: 700,
            lineHeight: 1,
          },
        },
        "✓",
      ),
    ),
    {
      width: size,
      height: size,
    },
  );
}
