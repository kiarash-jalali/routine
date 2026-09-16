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
  const checkWidth = Math.round(tileSize * 0.22);
  const checkHeight = Math.round(tileSize * 0.43);
  const checkStroke = Math.max(2, Math.round(tileSize * 0.075));
  const checkColor = maskable ? "#286e5e" : "#ffffff";

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
            boxShadow: maskable
              ? "0 0 0 1px rgba(255,255,255,0.14)"
              : "0 10px 30px rgba(40,110,94,0.18)",
          },
        },
        createElement("div", {
          style: {
            width: checkWidth,
            height: checkHeight,
            borderRight: `${checkStroke}px solid ${checkColor}`,
            borderBottom: `${checkStroke}px solid ${checkColor}`,
            transform: "translateY(-8%) rotate(45deg)",
          },
        }),
      ),
    ),
    {
      width: size,
      height: size,
    },
  );
}
