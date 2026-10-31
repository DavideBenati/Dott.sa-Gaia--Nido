import { useEffect, useState } from "react";
import { Platform } from "react-native";

/** A browser signal, not a guarantee that the server can be reached. */
export function useConnection() {
  const [online, setOnline] = useState(
    () =>
      Platform.OS !== "web" ||
      typeof navigator === "undefined" ||
      navigator.onLine !== false,
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  return online;
}
