import { Platform } from "react-native";
export const colors = {
  cream: "#FAF7F2",
  paper: "#FFFFFF",
  ink: "#303A35",
  muted: "#67736C",
  sage: "#8DAA91",
  sageDark: "#42624B",
  sagePale: "#E9EEE7",
  terracotta: "#DFA58A",
  clayDark: "#8C5137",
  peach: "#F6E7DC",
  border: "#E5E6DE",
  quiet: "#F0EEE7",
  white: "#FFFFFF",
  error: "#98442D",
};
export const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, serif",
});
export const sans = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui, -apple-system, sans-serif",
});
export const shadow = Platform.select({
  web: { boxShadow: "0 6px 30px rgba(48,58,53,0.05)" },
  default: {
    shadowColor: "#303A35",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 1,
  },
});
