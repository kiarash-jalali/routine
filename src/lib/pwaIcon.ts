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
  const markSize = Math.round(size * (maskable ? 0.7 : 0.76));
  const strokeWidth = maskable ? 10 : 11;
  const rootStrokeWidth = maskable ? 5 : 5.5;

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
          background: "#286e5e",
        },
      },
      createElement(
        "svg",
        {
          width: markSize,
          height: markSize,
          viewBox: "0 0 100 100",
          fill: "none",
        },
        createElement("path", {
          d: "M18 48 L40 67 L76 29",
          fill: "none",
          stroke: "#f5f5ee",
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
        createElement("path", {
          d: "M40 66 C40 75 35 82 29 87 M41 70 C47 77 49 83 48 89 M41 72 C51 77 58 81 63 87",
          fill: "none",
          stroke: "#f5f5ee",
          strokeWidth: rootStrokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
        createElement("path", {
          d: "M70 31 C70 24 74 21 79 21 C79 26 76 30 70 31 Z",
          fill: "#a4ddbe",
        }),
      ),
    ),
    {
      width: size,
      height: size,
    },
  );
}
