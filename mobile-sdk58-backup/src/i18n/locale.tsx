import { LocaleProvider } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { storage } from "@/session/storage";
import i18n, { directionOf, type Direction, type Lang } from "./index";

const LANG_KEY = "khidma.lang";

interface LocaleValue {
  lang: Lang;
  dir: Direction;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
}

const LocaleContext = createContext<LocaleValue | null>(null);

/**
 * Language and layout direction for the whole app.
 *
 * Instead of I18nManager.forceRTL (which needs an app restart and is ignored by Expo Go),
 * direction is applied to the view tree with the `direction` style, and Expo Router's
 * LocaleProvider mirrors navigation (headers, tab order, swipe-back). React Native resolves
 * text alignment and start/end spacing from that direction, so switching language is instant.
 */
export function AppLocaleProvider({ children }: PropsWithChildren) {
  // i18n was initialised with the device language, so the first render already matches.
  const [lang, setLangState] = useState<Lang>(i18n.language === "ar" ? "ar" : "en");

  const apply = useCallback((next: Lang) => {
    void i18n.changeLanguage(next);
    setLangState(next);
  }, []);

  // Restore the choice saved in a previous session.
  useEffect(() => {
    void storage.get(LANG_KEY).then((saved) => {
      if (saved === "ar" || saved === "en") apply(saved);
    });
  }, [apply]);

  // On the web, also set <html lang dir> so screen readers and the browser agree.
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = directionOf(lang);
    }
  }, [lang]);

  const setLang = useCallback(
    (next: Lang) => {
      apply(next);
      void storage.set(LANG_KEY, next);
    },
    [apply],
  );

  const value = useMemo<LocaleValue>(() => {
    const dir = directionOf(lang);
    return { lang, dir, isRTL: dir === "rtl", setLang };
  }, [lang, setLang]);

  return (
    <LocaleContext.Provider value={value}>
      <LocaleProvider direction={value.dir}>
        <View style={[styles.fill, { direction: value.dir }]}>{children}</View>
      </LocaleProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside AppLocaleProvider");
  return value;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
