"use client";
import { createContext, useContext, useEffect, useState, type ReactNode, } from "react";
import { getTranslations, type Locale, type Translations } from "@/lib/i18n";
interface LanguageContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: Translations;
}
const LanguageContext = createContext<LanguageContextValue>({
    locale: "en",
    setLocale: () => { },
    t: getTranslations("en"),
});
export function useLanguage() {
    return useContext(LanguageContext);
}
export function LanguageProvider({ children }: {
    children: ReactNode;
}) {
    const [locale, setLocaleState] = useState<Locale>("en");
    useEffect(() => {
        const saved = localStorage.getItem("speakup-lang") as Locale | null;
        if (saved === "en" || saved === "fil")
            setLocaleState(saved);
    }, []);
    const setLocale = (l: Locale) => {
        setLocaleState(l);
        localStorage.setItem("speakup-lang", l);
    };
    return (<LanguageContext.Provider value={{ locale, setLocale, t: getTranslations(locale) }}>
      {children}
    </LanguageContext.Provider>);
}
