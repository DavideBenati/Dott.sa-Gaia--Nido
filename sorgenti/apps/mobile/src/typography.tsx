import React, { forwardRef } from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { sans, serif } from "./theme";

// Each native font face has its own family. Select the actual face instead of
// relying on synthetic bold, which differs between browsers, iOS and Android.
function fontStyle(style: StyleProp<TextStyle>): TextStyle {
  const resolved = StyleSheet.flatten(style) ?? {};
  const family = resolved.fontFamily ?? sans;
  if (family === serif) {
    return {
      fontFamily: resolved.fontStyle === "italic" ? "NidoLoraItalic" : serif,
      fontWeight: "normal",
      fontStyle: "normal",
    };
  }
  if (family !== sans) return {};
  const weight =
    resolved.fontWeight === "bold" ? 700 : Number(resolved.fontWeight) || 400;
  return {
    fontFamily:
      weight >= 700
        ? "NidoSansBold"
        : weight >= 600
          ? "NidoSansSemibold"
          : weight >= 500
            ? "NidoSansMedium"
            : sans,
    fontWeight: "normal",
  };
}

export function Text({ style, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: sans }, style, fontStyle(style)]}
    />
  );
}

export const TextInput = forwardRef<
  React.ComponentRef<typeof NativeTextInput>,
  TextInputProps
>(function TextInput({ style, ...props }, ref) {
  return (
    <NativeTextInput
      ref={ref}
      {...props}
      style={[{ fontFamily: sans }, style, fontStyle(style)]}
    />
  );
});
