import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { type Article } from "@nido/core";
import { Icon, type IconName } from "./icons";
import { colors, serif, shadow } from "./theme";
import { useApp } from "./state";
import { ArticleCover } from "./art";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandIcon}>
        <Icon name="leaf" size={compact ? 23 : 29} color={colors.sageDark} />
      </View>
      <Text style={[styles.brandText, compact && { fontSize: 30 }]}>
        nido<Text style={{ color: colors.terracotta }}>.</Text>
      </Text>
    </View>
  );
}
export function Screen({
  children,
  title,
  eyebrow,
  subtitle,
  back,
  style,
}: {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  back?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { demo, email, mutationError, clearError } = useApp();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <View style={styles.topInner}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vai al mio percorso"
            onPress={() => router.navigate("/(tabs)")}
          >
            <Brand compact />
          </Pressable>
          <View style={styles.headerRight}>
            <View style={styles.mode}>
              <View style={styles.modeDot} />
              <Text style={styles.modeText}>
                {demo ? "DEMO MODE" : email ? "Il tuo spazio" : "Ospite"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quando chiedere aiuto"
              style={styles.roundButton}
              onPress={() => router.push("/help")}
            >
              <Icon name="help" size={22} />
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, style]}
        keyboardShouldPersistTaps="handled"
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
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
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        )}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>Insieme, passo dopo passo.</Text>
          <Text style={styles.footerSmall}>
            Uno spazio educativo, da vivere con i tuoi tempi.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={article.title}
        style={{ flex: 1 }}
        onPress={() =>
          router.push({ pathname: "/article/[id]", params: { id: article.id } })
        }
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
          <View style={styles.articleMeta}>
            <Icon name="clock" size={14} color={colors.muted} />
            <Text style={styles.metaText}>
              {article.readingMinutes} min di lettura
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>
              {article.isDemo ? "Esempio da revisionare" : "Revisionato"}
            </Text>
          </View>
        </View>
      </Pressable>
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
            width: width > 900 ? "31.8%" : width > 600 ? "48.5%" : "100%",
          }}
        >
          <ArticleCard article={article} />
        </View>
      ))}
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
  body: { color: colors.muted, fontSize: 15, lineHeight: 24 },
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
    paddingHorizontal: 24,
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", gap: 4, alignItems: "center" },
  brandIcon: { transform: [{ rotate: "-10deg" }], marginRight: 3 },
  brandText: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 43,
    letterSpacing: -2,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 15 },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.sagePale,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sageDark,
  },
  modeText: {
    fontSize: 9,
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
    letterSpacing: -0.7,
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
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  articleTitle: {
    fontFamily: serif,
    fontSize: 25,
    lineHeight: 31,
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
  metaText: { fontSize: 10, color: colors.muted },
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
  body: { color: colors.muted, fontSize: 15, lineHeight: 24, maxWidth: 430 },
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
  footerSmall: { color: colors.muted, fontSize: 10 },
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
