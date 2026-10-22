import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  articles as fixtures,
  checklists as fixtureChecklists,
  categories as fixtureCategories,
  defaultUserState,
  type Article,
  type Checklist,
  type Category,
  type Preferences,
  type UserState,
} from "@nido/core";
import {
  createNidoClient,
  loadPublicContent,
  loadUserState,
  savePreferences,
  setFavorite,
  setChecklistProgress,
  exportUserData,
  deleteAccount,
} from "@nido/data";

const LOCAL_KEY = "nido:user-state:v1";
const authStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) =>
          SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const configured = Boolean(url || anonKey);
let configurationError: string | null = null;
export const client = (() => {
  try {
    return createNidoClient(url, anonKey, { storage: authStorage });
  } catch {
    configurationError =
      "Configurazione Supabase non valida o incompleta. Controlla URL e chiave pubblica.";
    return null;
  }
})();
const freshState = (): UserState =>
  JSON.parse(JSON.stringify(defaultUserState)) as UserState;
interface AppContextValue {
  state: UserState;
  ready: boolean;
  demo: boolean;
  email: string | null;
  articles: Article[];
  checklists: Checklist[];
  categories: Category[];
  contentLoading: boolean;
  contentError: string | null;
  mutationError: string | null;
  refreshContent: () => Promise<void>;
  clearError: () => void;
  updatePreferences: (value: Preferences) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleProgress: (id: string) => Promise<void>;
  signIn: (
    email: string,
    password: string,
    signUp?: boolean,
  ) => Promise<string>;
  signOut: () => Promise<void>;
  exportData: () => Promise<object>;
  eraseData: () => Promise<void>;
}
const Context = createContext<AppContextValue | null>(null);
function readLocal(): Promise<UserState> {
  return AsyncStorage.getItem(LOCAL_KEY).then((value) => {
    if (!value) return freshState();
    try {
      const parsed = JSON.parse(value) as Partial<UserState>;
      return {
        preferences: { ...defaultUserState.preferences, ...parsed.preferences },
        favorites: Array.isArray(parsed.favorites)
          ? parsed.favorites.filter((id) => typeof id === "string")
          : [],
        progress:
          parsed.progress && typeof parsed.progress === "object"
            ? parsed.progress
            : {},
      };
    } catch {
      return freshState();
    }
  });
}
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Operazione non riuscita. Riprova tra poco.";
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserState>(freshState);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const signedInRef = useRef(false);
  const userIdRef = useRef<string | null | undefined>(undefined);
  const sessionEpoch = useRef(0);
  const hydratedRef = useRef(false);
  const authTransitionRef = useRef(false);
  const [articles, setArticles] = useState<Article[]>(
    configured ? [] : fixtures,
  );
  const [checklists, setChecklists] = useState<Checklist[]>(
    configured ? [] : fixtureChecklists,
  );
  const [categories, setCategories] = useState<Category[]>(
    configured ? [] : fixtureCategories,
  );
  const [contentLoading, setContentLoading] = useState(configured);
  const [contentError, setContentError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());
  const replaceState = useCallback((next: UserState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const refreshContent = useCallback(async () => {
    if (!configured) return;
    if (!client) {
      setContentLoading(false);
      setContentError(
        configurationError ??
          "Configurazione Supabase incompleta. Servono URL e chiave pubblica.",
      );
      return;
    }
    setContentLoading(true);
    setContentError(null);
    try {
      const data = await loadPublicContent(client);
      setArticles(data.articles);
      setChecklists(data.checklists);
      setCategories(data.categories);
    } catch {
      setContentError(
        "Non riusciamo a caricare i contenuti. Controlla la connessione e riprova. Nessun contenuto demo sostituisce i dati del servizio.",
      );
    } finally {
      setContentLoading(false);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    let authRevision = 0;
    function scheduleHydrate(user: { id: string; email?: string } | null) {
      const userId = user?.id ?? null;
      if (userIdRef.current === userId && hydratedRef.current) return;
      if (userIdRef.current !== userId) {
        userIdRef.current = userId;
        sessionEpoch.current++;
        hydratedRef.current = false;
        signedInRef.current = Boolean(user);
        replaceState(freshState());
        setEmail(user?.email ?? null);
        setReady(false);
      }
      const revision = ++authRevision;
      const epoch = sessionEpoch.current;
      // Defer database calls until Supabase releases its auth session lock.
      setTimeout(() => {
        void (async () => {
          try {
            const next =
              user && client ? await loadUserState(client) : await readLocal();
            if (
              alive &&
              revision === authRevision &&
              epoch === sessionEpoch.current
            ) {
              replaceState(next);
              hydratedRef.current = true;
              setMutationError(null);
            }
          } catch {
            if (
              alive &&
              revision === authRevision &&
              epoch === sessionEpoch.current
            ) {
              hydratedRef.current = false;
              replaceState(freshState());
              setMutationError(
                "Impossibile caricare le preferenze. Le modifiche sono sospese: esci e accedi nuovamente.",
              );
            }
          } finally {
            if (
              alive &&
              revision === authRevision &&
              epoch === sessionEpoch.current
            )
              setReady(true);
          }
        })();
      }, 0);
    }
    let authEventReceived = false;
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      if (alive) scheduleHydrate(session?.user ?? null);
    });
    if (client) {
      void client.auth.getSession().then(({ data, error }) => {
        if (!alive || authEventReceived) return;
        if (error)
          setMutationError(
            "Sessione non disponibile. Puoi continuare come ospite.",
          );
        scheduleHydrate(data.session?.user ?? null);
      });
    } else {
      scheduleHydrate(null);
    }
    void refreshContent();
    return () => {
      alive = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [refreshContent, replaceState]);
  const mutate = useCallback(
    (
      makeNext: (current: UserState) => UserState,
      remote: () => Promise<void>,
    ) => {
      const epoch = sessionEpoch.current;
      const job = queue.current.then(async () => {
        try {
          if (
            epoch !== sessionEpoch.current ||
            !hydratedRef.current ||
            authTransitionRef.current
          )
            throw new Error(
              "La sessione è cambiata o non è ancora pronta. Riprova.",
            );
          setMutationError(null);
          const next = makeNext(stateRef.current);
          if (signedInRef.current && client) await remote();
          else await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          if (epoch !== sessionEpoch.current) return;
          replaceState(next);
        } catch (error) {
          if (epoch === sessionEpoch.current)
            setMutationError(
              "Non abbiamo salvato la modifica. " + errorMessage(error),
            );
          throw error;
        }
      });
      queue.current = job.catch(() => {});
      return job;
    },
    [replaceState],
  );
  const updatePreferences = (preferences: Preferences) =>
    mutate(
      (current) => ({
        ...current,
        preferences: {
          ...preferences,
          date:
            preferences.personalized && preferences.sensitiveConsent
              ? preferences.date
              : null,
        },
      }),
      () =>
        client
          ? savePreferences(client, {
              ...preferences,
              date:
                preferences.personalized && preferences.sensitiveConsent
                  ? preferences.date
                  : null,
            })
          : Promise.resolve(),
    );
  const toggleFavorite = (id: string) => {
    let active = false;
    return mutate(
      (current) => {
        active = !current.favorites.includes(id);
        return {
          ...current,
          favorites: active
            ? [...current.favorites, id]
            : current.favorites.filter((item) => item !== id),
        };
      },
      () => (client ? setFavorite(client, id, active) : Promise.resolve()),
    );
  };
  const toggleProgress = (id: string) => {
    let active = false;
    return mutate(
      (current) => {
        active = !current.progress[id];
        return { ...current, progress: { ...current.progress, [id]: active } };
      },
      () =>
        client ? setChecklistProgress(client, id, active) : Promise.resolve(),
    );
  };
  const signIn = async (
    loginEmail: string,
    password: string,
    signUp = false,
  ) => {
    if (!client)
      throw new Error(
        "Gli account sono disponibili solo quando Supabase è configurato. La demo funziona senza account.",
      );
    if (authTransitionRef.current)
      throw new Error("Attendi il completamento dell’operazione in corso.");
    authTransitionRef.current = true;
    try {
      await queue.current;
      const result = signUp
        ? await client.auth.signUp({ email: loginEmail.trim(), password })
        : await client.auth.signInWithPassword({
            email: loginEmail.trim(),
            password,
          });
      if (result.error) throw new Error(result.error.message);
      return signUp && !result.data.session
        ? "Controlla la tua email per confermare la registrazione, poi accedi."
        : "Accesso effettuato.";
    } finally {
      authTransitionRef.current = false;
    }
  };
  const signOut = async () => {
    if (authTransitionRef.current)
      throw new Error("Attendi il completamento dell’operazione in corso.");
    authTransitionRef.current = true;
    try {
      await queue.current;
      if (client) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
    } finally {
      authTransitionRef.current = false;
    }
  };
  const exportData = async () =>
    signedInRef.current && client
      ? exportUserData(client)
      : {
          exportedAt: new Date().toISOString(),
          mode: configured ? "guest" : "demo",
          ...stateRef.current,
        };
  const eraseData = async () => {
    if (authTransitionRef.current)
      throw new Error("Attendi il completamento dell’operazione in corso.");
    authTransitionRef.current = true;
    try {
      await queue.current;
      if (signedInRef.current && client) await deleteAccount(client);
      sessionEpoch.current++;
      hydratedRef.current = false;
      await AsyncStorage.removeItem(LOCAL_KEY);
      if (client) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
      sessionEpoch.current++;
      signedInRef.current = false;
      userIdRef.current = null;
      replaceState(freshState());
      setEmail(null);
      setReady(true);
      hydratedRef.current = true;
    } finally {
      authTransitionRef.current = false;
    }
  };
  return (
    <Context.Provider
      value={{
        state,
        ready,
        demo: !configured,
        email,
        articles,
        checklists,
        categories,
        contentLoading,
        contentError,
        mutationError,
        refreshContent,
        clearError: () => setMutationError(null),
        updatePreferences,
        toggleFavorite,
        toggleProgress,
        signIn,
        signOut,
        exportData,
        eraseData,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("AppProvider mancante");
  return context;
}
