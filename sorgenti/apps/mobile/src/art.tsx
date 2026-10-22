import React from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Circle, Ellipse, Rect } from "react-native-svg";
export function NestArt({
  variant = 0,
  style,
}: {
  variant?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const backgrounds = ["#EAE1D4", "#E1E9DD", "#EBD9CC"];
  return (
    <View
      style={[
        { backgroundColor: backgrounds[variant % 3], overflow: "hidden" },
        style,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 500 340"
        preserveAspectRatio="xMidYMid slice"
      >
        <Rect width="500" height="340" fill={backgrounds[variant % 3]} />
        <Circle cx="385" cy="70" r="109" fill="#F4EEE3" opacity={0.7} />
        <Ellipse
          cx="237"
          cy="331"
          rx="220"
          ry="45"
          fill="#C6BDAA"
          opacity={0.35}
        />
        {variant % 3 === 0 ? (
          <>
            <Path
              d="M137 349c-3-78 18-122 40-139 20-15 64-37 95-10 46 40 83 67 89 149"
              fill="#78927B"
            />
            <Path
              d="M208 147c-28-41-8-81 20-89 43-12 69 19 62 57-5 27-15 36-21 51"
              fill="#574E40"
            />
            <Path
              d="M226 91c36-8 50 26 41 58-5 20-21 32-36 24-14-7-21-17-23-31 19-3 28-16 18-51"
              fill="#DFA58A"
            />
            <Path d="M231 168v30l36 20 12-21-17-32" fill="#DFA58A" />
            <Path
              d="M262 225c22-7 60 1 67 24 10 35-11 65-46 68-33 3-50-5-51-29"
              fill="#F0E8DA"
            />
            <Path
              d="M181 232c18-3 26 17 28 39l30 11c17 7 22 23 10 28-20 8-56-8-67-26-11-17-18-40-1-52"
              fill="#DFA58A"
            />
            <Path
              d="M304 232c13 4 19 19 11 30-7 8-22 7-28-3-7-11 4-27 17-27"
              fill="#E8BA9C"
            />
            <Path
              d="M301 242c4 7 9 8 13 8"
              stroke="#8C6C51"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M277 285c17 1 36-3 45-14"
              stroke="#CABDA6"
              strokeWidth="2"
              fill="none"
            />
          </>
        ) : variant % 3 === 1 ? (
          <>
            <Path
              d="M125 341c-17-43-4-97 40-118 38-19 112-21 145 9 28 26 43 68 39 109"
              fill="#BCC5AD"
            />
            <Path
              d="M190 253c-7-34 14-64 48-65 30-2 61 25 63 61 3 48-20 73-52 73-38 0-51-28-59-69"
              fill="#F8F2E5"
            />
            <Circle cx="243" cy="209" r="28" fill="#DFA98C" />
            <Path
              d="M217 209c1-21 12-29 27-29 22-1 28 15 27 27-13-10-35-11-54 2"
              fill="#C49E79"
            />
            <Path
              d="M226 211h1m28 0h1m-20 12c6 4 11 4 16 0"
              stroke="#8A6550"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M197 259c33-13 71-14 102-1M202 278c29-7 60-8 94-2"
              stroke="#DED6C5"
              strokeWidth="2"
              fill="none"
            />
            <Path
              d="M119 309c19-20 37-16 70 3m109-3c31-16 50-14 69 2"
              stroke="#D6AC8F"
              strokeWidth="27"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Path
              d="M153 340V205c0-43 32-62 62-62s63 24 63 62v135"
              fill="#ABBAA4"
            />
            <Circle cx="216" cy="112" r="38" fill="#DCA98B" />
            <Path
              d="M177 118c-22-25-14-59 12-69 34-13 65 7 64 41-12-2-35-13-44-22-2 28-13 42-32 50"
              fill="#655A49"
            />
            <Path
              d="M275 340V217c0-34 24-57 51-57 34 0 59 26 60 61v119"
              fill="#CB9A79"
            />
            <Circle cx="326" cy="127" r="33" fill="#E2B49A" />
            <Path
              d="M294 126c-10-27 3-47 30-46 26 0 40 16 35 38-19 0-30-10-37-19-3 15-12 23-28 27"
              fill="#554C40"
            />
            <Path
              d="M200 235c23 16 43 26 69 22l46-23"
              stroke="#DCA98B"
              strokeWidth="20"
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
        <Path
          d="M48 340c7-69 6-120-16-163m19 112c-30-5-36-28-31-46 23 7 31 23 31 46m-6-52c23-8 30-31 21-49-21 10-26 28-21 49m-10-39c-21-5-25-24-20-40 19 8 24 21 20 40M427 340c-1-76 9-134 37-169m-28 107c26-3 40-21 36-42-23 4-34 18-36 42m14-53c-22-10-22-33-11-50 19 12 18 29 11 50m15-43c26-2 35-17 34-36-20 1-33 14-34 36"
          fill="#71856A"
          opacity={0.8}
        />
      </Svg>
    </View>
  );
}
export function ArticleCover({
  uri,
  demo,
  style,
  variant = 0,
}: {
  uri: string;
  demo: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: number;
}) {
  const [failed, setFailed] = React.useState(false);
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <NestArt variant={variant} style={StyleSheet.absoluteFill} />
      {!demo && uri && !failed && (
        <Image
          accessibilityLabel="Immagine di copertina dell'articolo"
          source={{ uri }}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
