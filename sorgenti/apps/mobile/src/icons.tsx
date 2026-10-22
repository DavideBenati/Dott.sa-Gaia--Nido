import React from "react";
import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";
export type IconName =
  | "home"
  | "discover"
  | "checklist"
  | "profile"
  | "arrow"
  | "back"
  | "bookmark"
  | "heart"
  | "search"
  | "leaf"
  | "check"
  | "close"
  | "help"
  | "clock"
  | "sun"
  | "baby"
  | "bell"
  | "download"
  | "trash"
  | "mail"
  | "lock";
export function Icon({
  name,
  size = 23,
  color = "#42624B",
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <Path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7" />
      </>
    ),
    discover: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="m16 8-2 6-6 2 2-6Z" />
      </>
    ),
    checklist: (
      <>
        <Rect x="5" y="4" width="15" height="17" rx="2" />
        <Path d="M9 3h6v4H9zM9 12l1 1 2-2M14 12h3M9 17l1 1 2-2M14 17h3" />
      </>
    ),
    profile: (
      <>
        <Circle cx="12" cy="8" r="4" />
        <Path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    arrow: <Path d="M4 12h15m-5-5 5 5-5 5" />,
    back: <Path d="M20 12H5m5-5-5 5 5 5" />,
    bookmark: <Path d="M6 4h12v17l-6-4-6 4z" fill={filled ? color : "none"} />,
    heart: (
      <Path
        d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 2 11 8 15 6-4 13-10 8-15Z"
        fill={filled ? color : "none"}
      />
    ),
    search: (
      <>
        <Circle cx="10" cy="10" r="6" />
        <Path d="m15 15 6 6" />
      </>
    ),
    leaf: (
      <>
        <Path d="M4 19C3 10 8 4 20 3c0 12-6 17-14 15M4 21 15 10" />
        <Path d="m10 14-1-4m4 1 4 1" />
      </>
    ),
    check: <Path d="m5 12 4 4L19 6" />,
    close: <Path d="m6 6 12 12M6 18 18 6" />,
    help: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1.2-1 2M12 17h.01" />
      </>
    ),
    clock: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 6v6l4 2" />
      </>
    ),
    sun: (
      <>
        <Circle cx="12" cy="12" r="4" />
        <Path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    baby: (
      <>
        <Circle cx="12" cy="13" r="8" />
        <Path d="M10 5c5 0 4-4 2-3M8 12h.01M16 12h.01M9 16c2 2 4 2 6 0" />
      </>
    ),
    bell: (
      <>
        <Path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4" />
      </>
    ),
    download: (
      <>
        <Path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    trash: (
      <>
        <Path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    mail: (
      <>
        <Rect x="3" y="5" width="18" height="14" rx="2" />
        <Path d="m3 6 9 7 9-7" />
      </>
    ),
    lock: (
      <>
        <Rect x="5" y="10" width="14" height="11" rx="2" />
        <Path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
      </>
    ),
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? <Ellipse cx="12" cy="12" rx="7" ry="9" />}
    </Svg>
  );
}
