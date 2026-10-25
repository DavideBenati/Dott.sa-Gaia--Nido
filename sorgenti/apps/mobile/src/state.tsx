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
  publicArticle,
  publicChecklist,
  publicProfessionalText,
  nicknameIssue,
  pregnancyEstimatedDueDate,
  withSuppliedChecklists,
  type PregnancyProfile,
  normalizeNickname,
  type Article,
  type Checklist,
  type Category,
  type Preferences,
  type UserState,
  type MemberProfile,
  type SharedJourneyInput,
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
  loadMemberProfile,
  saveNickname,
  saveSharedJourney,
} from "@nido/data";

import { loadMyPregnancyProfile } from "./pregnancy-profile";

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
// Capture only the recovery intent before Supabase consumes and clears URL tokens.
// Fonts can finish loading after the SDK's initial PASSWORD_RECOVERY event.
let pendingRecovery =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
// Only retain a public error code, never the full callback URL or its tokens.
export const initialAuthLinkError =
  Platform.OS === "web" && typeof window !== "undefined"
    ? (new URLSearchParams(window.location.hash.slice(1)).get("error_code") ??
      new URLSearchParams(window.location.search).get("error_code"))
    : null;
export const client = (() => {
  try {
    return createNidoClient(url, anonKey, {
      storage: authStorage,
      detectSessionInUrl: Platform.OS === "web",
    });
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
  pregnancyProfile: PregnancyProfile | null;
  personalizedPreferences: Preferences;
  updatePregnancyProfile: (profile: PregnancyProfile | null) => void;
  memberProfile: MemberProfile | null;
  memberProfileLoading: boolean;
  memberProfileError: string | null;
  refreshMemberProfile: () => Promise<MemberProfile>;
  updateNickname: (nickname: string) => Promise<MemberProfile>;
  updateSharedJourney: (value: SharedJourneyInput) => Promise<MemberProfile>;
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
    nickname?: string,
  ) => Promise<string>;
  passwordRecovery: boolean;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
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
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(
    null,
  );
  const [memberProfileLoading, setMemberProfileLoading] = useState(false);
  const [memberProfileError, setMemberProfileError] = useState<string | null>(
    null,
  );
  const memberProfileReadyRef = useRef(false);
  const memberRevisionRef = useRef(0);
  const [pregnancyProfile, setPregnancyProfile] =
    useState<PregnancyProfile | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const signedInRef = useRef(false);
  const userIdRef = useRef<string | null | undefined>(undefined);
  const sessionEpoch = useRef(0);
  const hydratedRef = useRef(false);
  const authTransitionRef = useRef(false);
  const [articles, setArticles] = useState<Article[]>(
    configured ? [] : fixtures.map(publicArticle),
  );
  const [checklists, setChecklists] = useState<Checklist[]>(
    configured
      ? []
      : withSuppliedChecklists(fixtureChecklists.map(publicChecklist)),
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
      setArticles(data.articles.map(publicArticle));
      setChecklists(data.checklists.map(publicChecklist));
      setCategories(
        data.categories.map((category) => ({
          ...category,
          name: publicProfessionalText(category.name),
        })),
      );
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
      if (user && pendingRecovery) {
        pendingRecovery = false;
        setPasswordRecovery(true);
      }
      if (userIdRef.current === userId && hydratedRef.current) return;
      if (userIdRef.current !== userId) {
        userIdRef.current = userId;
        sessionEpoch.current++;
        hydratedRef.current = false;
        signedInRef.current = Boolean(user);
        replaceState(freshState());
        memberRevisionRef.current++;
        memberProfileReadyRef.current = false;
        setMemberProfile(null);
        setPregnancyProfile(null);
        setMemberProfileError(null);
        setMemberProfileLoading(Boolean(user));
        setEmail(user?.email ?? null);
        setReady(false);
      }
      const revision = ++authRevision;
      const epoch = sessionEpoch.current;
      const memberRevision = ++memberRevisionRef.current;
      // Defer database calls until Supabase releases its auth session lock.
      setTimeout(() => {
        // Profile information has its own readiness/error state: a missing
        // migration must not turn a successful login into an empty account.
        if (
          user &&
          client &&
          alive &&
          epoch === sessionEpoch.current &&
          memberRevision === memberRevisionRef.current
        ) {
          void loadMyPregnancyProfile(client)
            .then((profile) => {
              if (alive && epoch === sessionEpoch.current)
                setPregnancyProfile(profile);
            })
            .catch(() => {
              /* Missing clinical setup never blocks account access. */
            });
          setMemberProfileLoading(true);
          memberProfileReadyRef.current = false;
          void loadMemberProfile(client).then(
            (profile) => {
              if (
                alive &&
                memberRevision === memberRevisionRef.current &&
                epoch === sessionEpoch.current
              ) {
                setMemberProfile(profile);
                setMemberProfileError(null);
                setMemberProfileLoading(false);
                memberProfileReadyRef.current = true;
              }
            },
            (error: unknown) => {
              if (
                alive &&
                memberRevision === memberRevisionRef.current &&
                epoch === sessionEpoch.current
              ) {
                setMemberProfileError(errorMessage(error));
                setMemberProfileLoading(false);
                memberProfileReadyRef.current = false;
              }
            },
          );
        }
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
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (alive && event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (alive && event === "SIGNED_OUT") setPasswordRecovery(false);
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
  const refreshMemberProfile = useCallback(() => {
    const epoch = sessionEpoch.current;
    const job = queue.current.then(async () => {
      if (
        epoch !== sessionEpoch.current ||
        !signedInRef.current ||
        !client ||
        authTransitionRef.current
      )
        throw new Error("Accedi nuovamente per caricare il tuo profilo.");
      const revision = ++memberRevisionRef.current;
      memberProfileReadyRef.current = false;
      setMemberProfileLoading(true);
      setMemberProfileError(null);
      try {
        const next = await loadMemberProfile(client);
        if (
          epoch !== sessionEpoch.current ||
          revision !== memberRevisionRef.current
        )
          throw new Error("La sessione è cambiata. Riapri il tuo profilo.");
        setMemberProfile(next);
        memberProfileReadyRef.current = true;
        return next;
      } catch (error) {
        if (
          epoch === sessionEpoch.current &&
          revision === memberRevisionRef.current
        )
          setMemberProfileError(errorMessage(error));
        throw error;
      } finally {
        if (
          epoch === sessionEpoch.current &&
          revision === memberRevisionRef.current
        )
          setMemberProfileLoading(false);
      }
    });
    queue.current = job.then(
      () => {},
      () => {},
    );
    return job;
  }, []);
  const mutateMemberProfile = useCallback(
    (remote: (ownerId: string) => Promise<MemberProfile>) => {
      const epoch = sessionEpoch.current;
      const ownerId = userIdRef.current;
      const job = queue.current.then(async () => {
        if (
          epoch !== sessionEpoch.current ||
          !ownerId ||
          ownerId !== userIdRef.current ||
          !signedInRef.current ||
          !client ||
          authTransitionRef.current ||
          !memberProfileReadyRef.current
        )
          throw new Error(
            "Il profilo non è ancora disponibile. Ricaricalo prima di salvare.",
          );
        const revision = ++memberRevisionRef.current;
        setMemberProfileLoading(true);
        try {
          const next = await remote(ownerId);
          if (
            epoch !== sessionEpoch.current ||
            revision !== memberRevisionRef.current
          )
            throw new Error("La sessione è cambiata. Riapri il tuo profilo.");
          setMemberProfile(next);
          setMemberProfileError(null);
          return next;
        } finally {
          if (
            epoch === sessionEpoch.current &&
            revision === memberRevisionRef.current
          )
            setMemberProfileLoading(false);
        }
      });
      queue.current = job.then(
        () => {},
        () => {},
      );
      return job;
    },
    [],
  );
  const updateNickname = useCallback(
    (nickname: string) =>
      mutateMemberProfile((ownerId) =>
        saveNickname(client!, nickname, ownerId),
      ),
    [mutateMemberProfile],
  );
  const updateSharedJourney = useCallback(
    (value: SharedJourneyInput) =>
      mutateMemberProfile((ownerId) =>
        saveSharedJourney(client!, value, ownerId),
      ),
    [mutateMemberProfile],
  );
  const updatePreferences = (preferences: Preferences) =>
    mutate(
      (current) => ({
        ...current,
        preferences: {
          ...preferences,
          marketing: false,
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
              marketing: false,
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
    nickname?: string,
  ) => {
    if (!client)
      throw new Error(
        "Gli account sono disponibili solo quando Supabase è configurato. La demo funziona senza account.",
      );
    if (authTransitionRef.current)
      throw new Error("Attendi il completamento dell’operazione in corso.");
    if (signUp) {
      const issue = nicknameIssue(nickname ?? "");
      if (issue) throw new Error(issue);
    }
    authTransitionRef.current = true;
    try {
      await queue.current;
      const result = signUp
        ? await client.auth.signUp({
            email: loginEmail.trim(),
            password,
            options: {
              emailRedirectTo: "https://metimaia.com/account",
              data: { nickname: normalizeNickname(nickname ?? "") },
            },
          })
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
  const requestPasswordReset = async (loginEmail: string) => {
    if (!client) throw new Error("Servizio account non disponibile.");
    const { error } = await client.auth.resetPasswordForEmail(
      loginEmail.trim(),
      { redirectTo: "https://metimaia.com/account" },
    );
    if (error) throw error;
  };
  const changePassword = async (password: string) => {
    if (!client || !signedInRef.current)
      throw new Error(
        "Apri un link valido di recupero o accedi al tuo account.",
      );
    if (password.length < 8) throw new Error("Usa almeno 8 caratteri.");
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
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
  const pregnancyOwnerId = userIdRef.current;
  const updatePregnancyProfile = useCallback(
    (profile: PregnancyProfile | null) => {
      if (pregnancyOwnerId && pregnancyOwnerId === userIdRef.current)
        setPregnancyProfile(profile);
    },
    [pregnancyOwnerId],
  );
  const dueDate = pregnancyProfile
    ? pregnancyEstimatedDueDate(pregnancyProfile)
    : null;
  const personalizedPreferences: Preferences =
    dueDate &&
    state.preferences.journey === "pregnancy" &&
    !state.preferences.exploreOnly
      ? {
          ...state.preferences,
          date: dueDate,
          personalized: true,
          sensitiveConsent: true,
        }
      : state.preferences;
  const exportData = async () => {
    if (signedInRef.current && client) {
      const epoch = sessionEpoch.current;
      const [account, pregnancy] = await Promise.all([
        exportUserData(client),
        loadMyPregnancyProfile(client),
      ]);
      if (epoch !== sessionEpoch.current)
        throw new Error("L’account è cambiato. Riprova l’esportazione.");
      return { ...account, pregnancyProfile: pregnancy };
    }
    return {
      exportedAt: new Date().toISOString(),
      mode: configured ? "guest" : "demo",
      ...stateRef.current,
    };
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
      memberRevisionRef.current++;
      memberProfileReadyRef.current = false;
      setMemberProfile(null);
      setMemberProfileError(null);
      setMemberProfileLoading(false);
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
        memberProfile,
        pregnancyProfile,
        personalizedPreferences,
        updatePregnancyProfile,
        memberProfileLoading,
        memberProfileError,
        refreshMemberProfile,
        updateNickname,
        updateSharedJourney,
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
        passwordRecovery,
        requestPasswordReset,
        changePassword,
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
