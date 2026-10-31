import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, View } from "react-native";
import { Text } from "./typography";
import { confirmPendingNavigation } from "./unsaved-changes";
import { createUpdateWatchdog } from "./pwa-update-watchdog";
import {
  installPlatform,
  serviceWorkerOriginAllowed,
  standaloneDisplay,
  type InstallPlatform,
} from "./pwa-platform";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface PwaValue {
  standalone: boolean;
  platform: InstallPlatform;
  canInstall: boolean;
  installing: boolean;
  installMessage: string;
  install: () => Promise<void>;
  updateAvailable: boolean;
  updating: boolean;
  updateMessage: string;
  applyUpdate: () => void;
}

const defaults: PwaValue = {
  standalone: false,
  platform: "desktop",
  canInstall: false,
  installing: false,
  installMessage: "",
  install: async () => {},
  updateAvailable: false,
  updating: false,
  updateMessage: "",
  applyUpdate: () => {},
};
const Context = createContext<PwaValue>(defaults);

function currentStandalone() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return standaloneDisplay({
    displayMode:
      window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean })
      .standalone,
  });
}

export function usePwa() {
  return useContext(Context);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [standalone, setStandalone] = useState(currentStandalone);
  const [platform] = useState<InstallPlatform>(() =>
    Platform.OS === "web" && typeof navigator !== "undefined"
      ? installPlatform(navigator)
      : "desktop",
  );
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [reloadReady, setReloadReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const deferred = useRef<InstallPromptEvent | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updateWatchdog = useRef<ReturnType<typeof createUpdateWatchdog> | null>(
    null,
  );
  if (!updateWatchdog.current)
    updateWatchdog.current = createUpdateWatchdog(() => {
      setUpdating(false);
      setUpdateMessage(
        "L’aggiornamento sta impiegando più del previsto. Puoi riprovare: le modifiche non salvate restano qui.",
      );
    });
  const reloadOnce = useRef(false);

  const reloadWithPermission = useCallback(() => {
    if (reloadOnce.current || Platform.OS !== "web") return;
    if (
      !confirmPendingNavigation(
        "L’aggiornamento riaprirà MAIA. Hai modifiche non salvate: vuoi continuare senza salvarle?",
      )
    ) {
      setUpdateMessage(
        "Salva le modifiche e premi Aggiorna MAIA quando sei pronta.",
      );
      return;
    }
    reloadOnce.current = true;
    window.location.reload();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    let alive = true;
    let registration: ServiceWorkerRegistration | undefined;
    let lastUpdateCheck = 0;
    const cleanups: (() => void)[] = [];
    const media = window.matchMedia?.("(display-mode: standalone)");
    const displayChanged = () => setStandalone(currentStandalone());
    media?.addEventListener?.("change", displayChanged);
    const beforeInstall = (event: Event) => {
      const prompt = event as InstallPromptEvent;
      if (typeof prompt.prompt !== "function") return;
      event.preventDefault();
      deferred.current = prompt;
      setCanInstall(true);
      setInstallMessage("");
    };
    const installed = () => {
      deferred.current = null;
      setCanInstall(false);
      setInstallMessage(
        "Installazione completata. Ora puoi aprire MAIA dall’icona sul telefono.",
      );
      displayChanged();
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    // Production packaging adds this link. Demo/development exports retain
    // their existing behaviour and never register a root-scope worker.
    if (
      "serviceWorker" in navigator &&
      document.querySelector('link[rel="manifest"]') &&
      serviceWorkerOriginAllowed(window.location)
    ) {
      const controllerChanged = () => {
        if (!alive) return;
        const requested = updateWatchdog.current?.complete();
        setWaiting(null);
        setReloadReady(true);
        setUpdating(false);
        setUpdateMessage("");
        if (requested) reloadWithPermission();
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        controllerChanged,
      );
      cleanups.push(() =>
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          controllerChanged,
        ),
      );
      void navigator.serviceWorker
        .register("/service-worker.js", { scope: "/", updateViaCache: "none" })
        .then((value) => {
          if (!alive) return;
          registration = value;
          registrationRef.current = value;
          if (value.waiting) setWaiting(value.waiting);
          const observeInstalling = () => {
            const worker = value.installing;
            if (!worker) return;
            const stateChanged = () => {
              if (
                alive &&
                worker.state === "installed" &&
                navigator.serviceWorker.controller &&
                value.waiting
              )
                setWaiting(value.waiting);
              if (alive && worker.state === "redundant") {
                updateWatchdog.current?.cancel();
                setUpdating(false);
                setUpdateMessage(
                  "Aggiornamento non riuscito. Riprova più tardi.",
                );
              }
            };
            worker.addEventListener("statechange", stateChanged);
            cleanups.push(() =>
              worker.removeEventListener("statechange", stateChanged),
            );
            stateChanged();
          };
          value.addEventListener("updatefound", observeInstalling);
          cleanups.push(() =>
            value.removeEventListener("updatefound", observeInstalling),
          );
          observeInstalling();
        })
        .catch(() => {
          // Installation instructions and the connected site remain usable
          // when a browser does not support registering the worker.
        });
      const checkUpdates = () => {
        if (
          registration &&
          document.visibilityState === "visible" &&
          Date.now() - lastUpdateCheck >= 30000
        ) {
          lastUpdateCheck = Date.now();
          void registration.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", checkUpdates);
      window.addEventListener("online", checkUpdates);
      cleanups.push(() => {
        document.removeEventListener("visibilitychange", checkUpdates);
        window.removeEventListener("online", checkUpdates);
      });
    }
    return () => {
      alive = false;
      updateWatchdog.current?.cancel();
      registrationRef.current = null;
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      media?.removeEventListener?.("change", displayChanged);
      for (const cleanup of cleanups) cleanup();
    };
  }, [reloadWithPermission]);

  const install = useCallback(async () => {
    const event = deferred.current;
    if (!event || installing) return;
    deferred.current = null;
    setCanInstall(false);
    setInstalling(true);
    try {
      await event.prompt();
      const result = await event.userChoice;
      setInstallMessage(
        result.outcome === "accepted"
          ? "Hai confermato l’installazione. Cerca l’icona MAIA sul telefono."
          : "Puoi installare MAIA in un altro momento dal menu del browser.",
      );
    } catch {
      setInstallMessage(
        "Usa il menu del browser e segui le istruzioni qui sotto per aggiungere MAIA.",
      );
    } finally {
      setInstalling(false);
    }
  }, [installing]);

  const applyUpdate = useCallback(() => {
    if (updating) return;
    if (reloadReady) {
      reloadWithPermission();
      return;
    }
    const worker = registrationRef.current?.waiting ?? waiting;
    if (!worker) return;
    if (worker.state === "redundant") {
      updateWatchdog.current?.cancel();
      setUpdateMessage(
        "Questa versione non è più disponibile. Controllo gli aggiornamenti: riprova tra qualche istante.",
      );
      void registrationRef.current?.update().catch(() => {});
      return;
    }
    if (worker.state === "activated") {
      updateWatchdog.current?.cancel();
      setReloadReady(true);
      reloadWithPermission();
      return;
    }
    setUpdateMessage("");
    setUpdating(true);
    updateWatchdog.current?.start();
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      updateWatchdog.current?.cancel();
      setUpdating(false);
      setUpdateMessage("Aggiornamento non riuscito. Riprova più tardi.");
    }
  }, [waiting, reloadReady, updating, reloadWithPermission]);

  return (
    <Context.Provider
      value={{
        standalone,
        platform,
        canInstall,
        installing,
        installMessage,
        install,
        updateAvailable: Boolean(waiting) || reloadReady,
        updating,
        updateMessage,
        applyUpdate,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function PwaUpdateNotice() {
  const pwa = usePwa();
  if (!pwa.standalone || !pwa.updateAvailable) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: "#E8EFE4", padding: 12, gap: 8 }}
    >
      <Text style={{ color: "#30443A", fontSize: 14 }}>
        {pwa.updateMessage || "È pronta una nuova versione di MAIA."}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aggiorna MAIA"
        disabled={pwa.updating}
        onPress={pwa.applyUpdate}
        style={{
          minHeight: 44,
          alignSelf: "flex-start",
          justifyContent: "center",
          paddingHorizontal: 16,
          borderRadius: 10,
          backgroundColor: "#42624B",
        }}
      >
        <Text style={{ color: "#FFF", fontSize: 14 }}>
          {pwa.updating ? "Preparazione aggiornamento…" : "Aggiorna MAIA"}
        </Text>
      </Pressable>
    </View>
  );
}
