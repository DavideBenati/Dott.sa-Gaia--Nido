import maiaLogo from "../assets/brand/maia-logo.png";
import { Text } from "./typography";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, usePathname } from "expo-router";
import { type Article } from "@nido/core";
import { Icon, type IconName } from "./icons";
import { colors, serif, shadow } from "./theme";
import { useApp } from "./state";
import { usePageMetadata } from "./seo";
import { ArticleCover } from "./art";
import { guardedNavigation } from "./unsaved-changes";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      source={maiaLogo}
      accessibilityLabel="MAIA"
      accessibilityRole="image"
      resizeMode="contain"
      style={{
        width: compact ? 102 : 200,
        height: compact ? 76 : 200,
        alignSelf: "flex-start",
      }}
    />
  );
}
export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  back,
  style,
  stageKey,
  focusTargetId,
  stageScroll = "start",
  professional = false,
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  back?: boolean;
  style?: StyleProp<ViewStyle>;
  stageKey?: string | number;
  focusTargetId?: string;
  stageScroll?: "start" | "heading";
  professional?: boolean;
}) {
  usePageMetadata();
  const pathname = usePathname();
  const { demo, email, mutationError, clearError } = useApp();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const previousStage = useRef(stageKey);
  useEffect(() => {
    // Only a deliberate phase transition resets the viewport. Typing, changing
    // a preference and ordinary renders must preserve both focus and scroll.
    if (previousStage.current === stageKey) return;
    previousStage.current = stageKey;
    if (stageKey === undefined) return;
    Keyboard.dismiss();
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS !== "web" || !focusTargetId) return;
      const container: unknown = scroll.current?.getScrollableNode();
      if (!(container instanceof HTMLElement)) return;
      // Scope lookup to this screen: other stack entries may remain mounted.
      const target = Array.from(
        container.querySelectorAll<HTMLElement>("[id]"),
      ).find((element) => element.id === focusTargetId);
      if (!target) return;
      const bounds = container.getBoundingClientRect();
      const heading = target.getBoundingClientRect();
      // Preserve the phase's back control when its heading already fits. Long
      // introductions may require moving directly to the new phase heading.
      const top =
        stageScroll === "heading" ||
        heading.top < bounds.top ||
        heading.bottom > bounds.bottom
          ? Math.max(0, container.scrollTop + heading.top - bounds.top - 16)
          : 0;
      target.focus({ preventScroll: true });
      container.scrollTop = top;
    });
    return () => cancelAnimationFrame(frame);
  }, [stageKey, focusTargetId, stageScroll]);
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <View style={styles.topInner}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              professional ? "Torna a Studio" : "Vai al mio percorso"
            }
            onPress={() => {
              if (professional && pathname === "/studio") return;
              guardedNavigation(() =>
                professional
                  ? router.navigate("/studio")
                  : router.navigate("/(tabs)"),
              );
            }}
          >
            <Brand compact />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                demo
                  ? "Informazioni sulla modalità demo"
                  : email
                    ? "Gestisci account"
                    : "Accedi al tuo account"
              }
              onPress={() => guardedNavigation(() => router.push("/account"))}
              style={styles.mode}
            >
              <View style={styles.modeDot} />
              <Text style={styles.modeText}>
                {demo ? "DEMO MODE" : email ? "Il tuo account" : "Accedi"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quando chiedere aiuto"
              style={styles.roundButton}
              onPress={() => guardedNavigation(() => router.push("/help"))}
            >
              <Icon name="help" size={22} />
            </Pressable>
          </View>
        </View>
      </View>
      <View
        style={{
          backgroundColor: colors.cream,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          accessibilityRole="navigation"
          style={{
            width: "100%",
            maxWidth: 1176,
            alignSelf: "center",
            paddingHorizontal: 20,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {professional ? (
            <>
              <Link
                href="/studio"
                style={{
                  padding: 12,
                  minHeight: 44,
                  color: colors.sageDark,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                Studio
              </Link>
              <Link
                href="/discover"
                style={{
                  padding: 12,
                  minHeight: 44,
                  color: colors.sageDark,
                  fontSize: 14,
                }}
              >
                Anteprima sito
              </Link>
              <Link
                href="/sicurezza"
                style={{
                  padding: 12,
                  minHeight: 44,
                  color: colors.sageDark,
                  fontSize: 14,
                }}
              >
                Sicurezza
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/gaia"
                accessibilityLabel="Conosci Gaia e i servizi"
                style={{
                  padding: 12,
                  minHeight: 44,
                  color: colors.sageDark,
                  fontSize: 14,
                }}
              >
                Gaia e servizi
              </Link>
              <Link
                href="/contatti"
                style={{
                  padding: 12,
                  minHeight: 44,
                  color: colors.sageDark,
                  fontSize: 14,
                }}
              >
                Contatti
              </Link>
              <Link
                href="/shop"
                accessibilityLabel="Apri lo Shop metiMaia"
                style={{
                  padding: 12,
                  minHeight: 44,
                  color: colors.sageDark,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                Shop
              </Link>
            </>
          )}
        </View>
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.scroll,
          !desktop && { paddingHorizontal: 20, paddingTop: 24 },
          style,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              guardedNavigation(() =>
                router.canGoBack()
                  ? router.back()
                  : professional
                    ? router.replace("/studio")
                    : router.replace("/(tabs)"),
              )
            }
            style={styles.back}
          >
            <Icon name="back" size={20} />
            <Text style={styles.backText}>Indietro</Text>
          </Pressable>
        )}
        {mutationError && (
          <View accessibilityRole="alert" style={styles.error}>
            <Text style={styles.errorText}>{mutationError}</Text>
            <Pressable
              accessibilityLabel="Chiudi messaggio"
              onPress={clearError}
              style={styles.roundButton}
            >
              <Icon name="close" size={18} />
            </Pressable>
          </View>
        )}
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        {title && (
          <Text
            accessibilityRole="header"
            style={[styles.title, !desktop && { fontSize: 32, lineHeight: 39 }]}
          >
            {title}
          </Text>
        )}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children}
        {professional ? (
          <View style={styles.footer}>
            <Text style={styles.footerSmall}>
              metiMaia · Area professionale
            </Text>
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>Insieme, passo dopo passo.</Text>
            <Text style={styles.footerSmall}>
              Uno spazio educativo, da vivere con i tuoi tempi.
            </Text>
            <Button variant="secondary" onPress={() => router.push("/prenota")}>
              Richiedi un incontro
            </Button>
            <Button variant="quiet" onPress={() => router.push("/contatti")}>
              Come contattare Gaia
            </Button>
            <Button variant="quiet" onPress={() => router.push("/shop")}>
              Shop metiMaia
            </Button>
            <View style={ui.row}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/privacy")}
                style={styles.sectionAction}
              >
                <Text style={styles.actionText}>Privacy e dati</Text>
              </Pressable>
              <Text style={styles.footerSmall}>·</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/help")}
                style={styles.sectionAction}
              >
                <Text style={styles.actionText}>Quando chiedere aiuto</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
export function StageHeading({
  id,
  children,
  style,
}: {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      nativeID={id}
      tabIndex={-1}
      accessibilityRole="header"
      style={[ui.heading, style]}
    >
      {children}
    </Text>
  );
}

export function Button({
  children,
  onPress,
  variant = "primary",
  icon,
  disabled,
  accessibilityLabel,
}: {
  children: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "quiet" && styles.buttonQuiet,
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant !== "primary" && { color: colors.sageDark },
        ]}
      >
        {children}
      </Text>
      {icon && (
        <Icon
          name={icon}
          size={20}
          color={variant === "primary" ? colors.white : colors.sageDark}
        />
      )}
    </Pressable>
  );
}
export function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={styles.sectionAction}
        >
          <Text style={styles.actionText}>{action}</Text>
          <Icon name="arrow" size={17} />
        </Pressable>
      )}
    </View>
  );
}
export function Tag({
  children,
  warm = false,
}: {
  children: string;
  warm?: boolean;
}) {
  return (
    <View style={[styles.tag, warm && { backgroundColor: colors.peach }]}>
      <Text style={[styles.tagText, warm && { color: colors.clayDark }]}>
        {children}
      </Text>
    </View>
  );
}
export function Notice({
  children,
  icon = "leaf",
  warm = false,
}: {
  children: React.ReactNode;
  icon?: IconName;
  warm?: boolean;
}) {
  return (
    <View style={[styles.notice, warm && { backgroundColor: colors.peach }]}>
      <Icon
        name={icon}
        size={23}
        color={warm ? colors.clayDark : colors.sageDark}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.noticeText}>{children}</Text>
      </View>
    </View>
  );
}
export function ArticleCard({
  article,
  compact = false,
}: {
  article: Article;
  compact?: boolean;
}) {
  const { categories, state, toggleFavorite } = useApp();
  const saved = state.favorites.includes(article.id);
  return (
    <View style={[styles.articleCard, compact && styles.compactCard]}>
      <Link href={{ pathname: "/article", params: { id: article.id } }} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={article.title}
          style={{ flex: 1 }}
        >
          <ArticleCover
            uri={article.imageUrl}
            demo={article.isDemo}
            variant={article.title.length % 3}
            style={[styles.articleImage, compact && { height: 130 }]}
          />
          <View style={styles.articleBody}>
            <Text style={styles.articleCategory}>
              {categories.find((category) => category.id === article.categoryId)
                ?.name ?? "Da scoprire"}
            </Text>
            <Text style={[styles.articleTitle, compact && { fontSize: 22 }]}>
              {article.title}
            </Text>
            {!compact && (
              <Text numberOfLines={2} style={styles.articleSubtitle}>
                {article.subtitle}
              </Text>
            )}
            {!compact && (
              <Text style={styles.metaText}>
                {article.authorName} · {article.authorRole}
              </Text>
            )}
            {!compact && article.reviewedAt && (
              <Text
                style={styles.metaText}
              >{`Ultima revisione: ${article.reviewedAt}`}</Text>
            )}
            <View style={styles.articleMeta}>
              <Icon name="clock" size={14} color={colors.muted} />
              <Text style={styles.metaText}>
                {article.readingMinutes} min di lettura
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>
                {article.isDemo
                  ? "Esempio da revisionare"
                  : article.approved && article.reviewedAt
                    ? "Revisionato"
                    : "Da revisionare"}
              </Text>
            </View>
          </View>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          saved
            ? `Rimuovi dai salvati: ${article.title}`
            : `Salva articolo: ${article.title}`
        }
        accessibilityState={{ selected: saved }}
        aria-pressed={saved}
        onPress={() => {
          void toggleFavorite(article.id).catch(() => {});
        }}
        style={styles.bookmark}
      >
        <Icon name="bookmark" size={21} filled={saved} />
      </Pressable>
    </View>
  );
}
export function ArticleGrid({ items }: { items: Article[] }) {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.grid}>
      {items.map((article) => (
        <View
          key={article.id}
          style={{
            width: width >= 1000 ? "31.8%" : width >= 700 ? "48.5%" : "100%",
            flexGrow: 1,
            maxWidth: width >= 1000 ? "32.5%" : width >= 700 ? "49%" : "100%",
          }}
        >
          <ArticleCard article={article} />
        </View>
      ))}
    </View>
  );
}
export function Progress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <View style={{ gap: 9 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {completed} di {total} completati
        </Text>
        <Text
          style={{ color: colors.sageDark, fontSize: 13, fontWeight: "700" }}
        >
          {percent}%
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Avanzamento checklist"
        accessibilityValue={{ min: 0, max: total, now: completed }}
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.sagePale,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${percent}%`,
            height: "100%",
            backgroundColor: colors.sageDark,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  text,
  action,
  onPress,
}: {
  title: string;
  text: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="leaf" size={36} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={[styles.body, { textAlign: "center" }]}>{text}</Text>
      {action && onPress && (
        <Button onPress={onPress} variant="secondary">
          {action}
        </Button>
      )}
    </View>
  );
}
export function ContentStatus() {
  const { contentLoading, contentError, refreshContent } = useApp();
  if (contentLoading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.sageDark} />
        <Text style={styles.body}>Prepariamo il tuo spazio…</Text>
      </View>
    );
  if (contentError)
    return (
      <View style={{ gap: 15 }}>
        <Notice icon="help" warm>
          {contentError}
        </Notice>
        <Button
          onPress={() => {
            void refreshContent();
          }}
          variant="secondary"
        >
          Riprova a caricare
        </Button>
      </View>
    );
  return null;
}
export const ui = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    ...shadow,
  },
  body: { color: colors.muted, fontSize: 16, lineHeight: 26 },
  heading: {
    fontFamily: serif,
    color: colors.ink,
    fontSize: 27,
    lineHeight: 34,
  },
  label: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    color: colors.ink,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: colors.sageDark,
    borderColor: colors.sageDark,
  },
  pillText: { color: colors.muted, fontSize: 14, fontWeight: "500" },
  pillTextActive: { color: colors.white },
});
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cream,
  },
  topInner: {
    width: "100%",
    maxWidth: 1176,
    alignSelf: "center",
    paddingHorizontal: 20,
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.sagePale,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  modeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sageDark,
  },
  modeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.sageDark,
    letterSpacing: 1,
  },
  roundButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  scroll: {
    width: "100%",
    maxWidth: 1176,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 28,
  },
  eyebrow: {
    color: colors.sageDark,
    letterSpacing: 2,
    fontWeight: "600",
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    fontFamily: serif,
    color: colors.ink,
    fontSize: 38,
    lineHeight: 46,
    marginBottom: 10,
    maxWidth: 760,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 680,
    marginBottom: 26,
  },
  button: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.sageDark,
    borderRadius: 13,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  buttonSecondary: {
    backgroundColor: colors.sagePale,
    borderWidth: 1,
    borderColor: "#D6E0D2",
  },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonText: { fontSize: 15, color: colors.white, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    marginTop: 32,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontFamily: serif,
    color: colors.ink,
    fontSize: 27,
    lineHeight: 34,
  },
  sectionAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionText: { color: colors.sageDark, fontSize: 13, fontWeight: "600" },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.sagePale,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  tagText: {
    color: colors.sageDark,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    backgroundColor: colors.sagePale,
    padding: 18,
    borderRadius: 17,
    marginTop: 14,
  },
  noticeText: { color: colors.sageDark, fontSize: 13, lineHeight: 21 },
  articleCard: {
    position: "relative",
    backgroundColor: colors.paper,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    height: "100%",
    ...shadow,
  },
  compactCard: { maxWidth: 390 },
  articleImage: { height: 175, width: "100%", backgroundColor: colors.peach },
  articleBody: { padding: 20, paddingTop: 18, gap: 10 },
  articleCategory: {
    color: colors.sageDark,
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  articleTitle: {
    fontFamily: serif,
    fontSize: 24,
    lineHeight: 33,
    color: colors.ink,
    paddingRight: 4,
  },
  articleSubtitle: { fontSize: 13, color: colors.muted, lineHeight: 21 },
  articleMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 5,
  },
  metaText: { fontSize: 12, color: colors.muted },
  metaDot: { color: colors.sage },
  bookmark: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: colors.cream,
    borderRadius: 23,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 25,
    gap: 15,
    backgroundColor: colors.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 20,
  },
  emptyIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sagePale,
    marginBottom: 5,
  },
  body: { color: colors.muted, fontSize: 16, lineHeight: 26, maxWidth: 430 },
  loading: { padding: 35, alignItems: "center", gap: 15 },
  footer: { alignItems: "center", paddingTop: 42, paddingBottom: 16, gap: 7 },
  footerLine: {
    height: 1,
    width: 36,
    backgroundColor: colors.sage,
    marginBottom: 10,
  },
  footerText: {
    fontFamily: serif,
    color: colors.muted,
    fontStyle: "italic",
    fontSize: 18,
  },
  footerSmall: { color: colors.muted, fontSize: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 44,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backText: { color: colors.sageDark, fontSize: 13 },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.peach,
    paddingLeft: 16,
    paddingVertical: 6,
    borderRadius: 13,
    marginBottom: 18,
  },
  errorText: { color: colors.clayDark, flex: 1, fontSize: 13, lineHeight: 21 },
});
