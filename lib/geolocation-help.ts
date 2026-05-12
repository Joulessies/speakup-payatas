import type { Locale } from "@/lib/i18n";

export type BrowserName =
    | "chrome"
    | "safari"
    | "firefox"
    | "edge"
    | "samsung"
    | "opera"
    | "facebook"
    | "messenger"
    | "instagram"
    | "tiktok"
    | "line"
    | "unknown";

export type OsName = "ios" | "android" | "macos" | "windows" | "linux" | "unknown";

export interface PlatformInfo {
    browser: BrowserName;
    os: OsName;
    isInAppWebView: boolean;
    inAppName?: string;
    isSecureContext: boolean;
}

export function detectPlatform(): PlatformInfo {
    if (typeof navigator === "undefined") {
        return { browser: "unknown", os: "unknown", isInAppWebView: false, isSecureContext: true };
    }
    const ua = navigator.userAgent || "";
    const maxTouchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isMac = /Macintosh/.test(ua) && !isIOS;
    const isWindows = /Windows NT/.test(ua);
    const isLinux = /Linux/.test(ua) && !isAndroid;

    const os: OsName = isIOS
        ? "ios"
        : isAndroid
            ? "android"
            : isMac
                ? "macos"
                : isWindows
                    ? "windows"
                    : isLinux
                        ? "linux"
                        : "unknown";

    let browser: BrowserName = "unknown";
    let isInAppWebView = false;
    let inAppName: string | undefined;

    if (/FB_IAB\/MESSENGER|MessengerLite/i.test(ua) || (/Messenger/i.test(ua) && /FBAV|FBAN/.test(ua))) {
        browser = "messenger";
        isInAppWebView = true;
        inAppName = "Messenger";
    } else if (/FBAN|FBAV|FB_IAB/.test(ua)) {
        browser = "facebook";
        isInAppWebView = true;
        inAppName = "Facebook";
    } else if (/Instagram/.test(ua)) {
        browser = "instagram";
        isInAppWebView = true;
        inAppName = "Instagram";
    } else if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) {
        browser = "tiktok";
        isInAppWebView = true;
        inAppName = "TikTok";
    } else if (/Line\//.test(ua)) {
        browser = "line";
        isInAppWebView = true;
        inAppName = "Line";
    } else if (/SamsungBrowser/.test(ua)) {
        browser = "samsung";
    } else if (/Edg\//.test(ua)) {
        browser = "edge";
    } else if (/OPR\/|Opera/.test(ua)) {
        browser = "opera";
    } else if (/FxiOS|Firefox/.test(ua)) {
        browser = "firefox";
    } else if (/CriOS/.test(ua)) {
        browser = "chrome";
    } else if (/Chrome\//.test(ua) && !/Edg\/|OPR\/|SamsungBrowser/.test(ua)) {
        browser = "chrome";
    } else if (/Safari/.test(ua) && /Version\//.test(ua)) {
        browser = "safari";
    }

    let isSecureContext = true;
    if (typeof window !== "undefined") {
        if (typeof window.isSecureContext === "boolean") {
            isSecureContext = window.isSecureContext;
        } else {
            const proto = window.location.protocol;
            const host = window.location.hostname;
            isSecureContext = proto === "https:" || host === "localhost" || host === "127.0.0.1";
        }
    }

    return { browser, os, isInAppWebView, inAppName, isSecureContext };
}

export function getBrowserDisplayName(b: BrowserName): string {
    const map: Record<BrowserName, string> = {
        chrome: "Chrome",
        safari: "Safari",
        firefox: "Firefox",
        edge: "Microsoft Edge",
        samsung: "Samsung Internet",
        opera: "Opera",
        facebook: "Facebook in-app browser",
        messenger: "Messenger in-app browser",
        instagram: "Instagram in-app browser",
        tiktok: "TikTok in-app browser",
        line: "Line in-app browser",
        unknown: "your browser",
    };
    return map[b];
}

export function getOsDisplayName(o: OsName): string {
    const map: Record<OsName, string> = {
        ios: "iOS",
        android: "Android",
        macos: "macOS",
        windows: "Windows",
        linux: "Linux",
        unknown: "your device",
    };
    return map[o];
}

export interface StepGroup {
    heading: string;
    steps: string[];
}

const HELP_TEXT: Record<Locale, Record<string, StepGroup>> = {
    en: {
        inAppWebView: {
            heading: "Open this page in a real browser",
            steps: [
                "Tap the three-dots (⋯) or menu icon in the corner of this view.",
                "Choose 'Open in browser', 'Open in Chrome', or 'Open in Safari'.",
                "Once it opens in the browser, tap 'Allow' when it asks for your location.",
            ],
        },
        chromeAndroid: {
            heading: "Chrome on Android",
            steps: [
                "Tap the lock or info icon (🔒 or ⓘ) on the left of the address bar.",
                "Tap 'Permissions' or 'Site settings'.",
                "Tap 'Location' and choose 'Allow'.",
                "Reload the page, then tap 'Detect My Location' again.",
            ],
        },
        chromeDesktop: {
            heading: "Chrome on computer",
            steps: [
                "Click the lock or tune icon (🔒) on the left of the address bar.",
                "Click 'Site settings' (or 'Permissions').",
                "Find 'Location' and change it to 'Allow'.",
                "Reload the page, then click 'Detect My Location' again.",
            ],
        },
        safariIos: {
            heading: "Safari on iPhone or iPad",
            steps: [
                "Open the iPhone 'Settings' app.",
                "Tap 'Privacy & Security' → 'Location Services' and make sure it is ON.",
                "Scroll down to 'Safari Websites' and choose 'While Using the App'.",
                "Return to this page and tap 'Detect My Location' again. Tap 'Allow' on the prompt.",
            ],
        },
        safariMacos: {
            heading: "Safari on Mac",
            steps: [
                "From the Safari menu bar, choose 'Safari' → 'Settings…' (or 'Preferences…').",
                "Open the 'Websites' tab, then choose 'Location' on the left.",
                "Find this site in the list and set it to 'Allow'.",
                "Reload the page, then click 'Detect My Location' again.",
            ],
        },
        firefoxDesktop: {
            heading: "Firefox on computer",
            steps: [
                "Click the lock icon (🔒) on the left of the address bar.",
                "Click 'Connection secure' → 'More information' → 'Permissions' tab.",
                "Remove the block for 'Access Your Location', or change it to 'Allow'.",
                "Reload the page and tap 'Detect My Location' again.",
            ],
        },
        firefoxAndroid: {
            heading: "Firefox on Android",
            steps: [
                "Tap the lock icon next to the address bar.",
                "Tap 'Edit site permissions' → 'Location' → 'Allow'.",
                "Reload the page, then tap 'Detect My Location' again.",
            ],
        },
        edgeDesktop: {
            heading: "Microsoft Edge",
            steps: [
                "Click the lock icon (🔒) on the left of the address bar.",
                "Click 'Permissions for this site'.",
                "Set 'Location' to 'Allow'.",
                "Reload the page and click 'Detect My Location' again.",
            ],
        },
        samsung: {
            heading: "Samsung Internet",
            steps: [
                "Tap the lock icon next to the address bar.",
                "Tap 'Permissions' → 'Location' → 'Allow'.",
                "Reload the page and tap 'Detect My Location' again.",
            ],
        },
        iosSettings: {
            heading: "Also check iPhone Location Services",
            steps: [
                "Open the 'Settings' app on your iPhone.",
                "Tap 'Privacy & Security' → 'Location Services' and turn it ON.",
                "Scroll to your browser (Chrome, Safari, etc.) and choose 'While Using the App'.",
                "Return here and tap 'Detect My Location' again.",
            ],
        },
        androidSettings: {
            heading: "Also check Android Location settings",
            steps: [
                "Open your phone's 'Settings'.",
                "Tap 'Location' and make sure it is ON.",
                "Tap 'Mode' or 'Location services' and choose 'High accuracy'.",
                "Return here and tap 'Detect My Location' again.",
            ],
        },
        generic: {
            heading: "Other browsers",
            steps: [
                "Look for a lock or info icon next to the website address.",
                "Open 'Site permissions' or 'Site settings'.",
                "Change 'Location' to 'Allow'.",
                "Reload the page and try detecting your location again.",
            ],
        },
        mapFallback: {
            heading: "Or skip GPS — just use the map",
            steps: [
                "Scroll down to the map below.",
                "Tap or drag the pin to the exact spot inside the purple Payatas outline.",
                "Your report will be submitted using that location — no GPS needed.",
            ],
        },
    },
    fil: {
        inAppWebView: {
            heading: "Buksan ang pahinang ito sa totoong browser",
            steps: [
                "Pindutin ang tatlong tuldok (⋯) o menu icon sa sulok ng view.",
                "Piliin ang 'Open in browser', 'Open in Chrome', o 'Open in Safari'.",
                "Kapag bumukas na sa browser, pindutin ang 'Allow' kapag hiningi ang lokasyon.",
            ],
        },
        chromeAndroid: {
            heading: "Chrome sa Android",
            steps: [
                "Pindutin ang lock o info icon (🔒 o ⓘ) sa kaliwa ng address bar.",
                "Pindutin ang 'Permissions' o 'Site settings'.",
                "Pindutin ang 'Location' at piliin ang 'Allow'.",
                "I-reload ang pahina, tapos pindutin muli ang 'Detect My Location'.",
            ],
        },
        chromeDesktop: {
            heading: "Chrome sa computer",
            steps: [
                "I-click ang lock icon (🔒) sa kaliwa ng address bar.",
                "I-click ang 'Site settings' (o 'Permissions').",
                "Hanapin ang 'Location' at palitan sa 'Allow'.",
                "I-reload ang pahina, tapos i-click muli ang 'Detect My Location'.",
            ],
        },
        safariIos: {
            heading: "Safari sa iPhone o iPad",
            steps: [
                "Buksan ang 'Settings' app sa iPhone.",
                "Pindutin ang 'Privacy & Security' → 'Location Services' at siguraduhing naka-ON.",
                "Mag-scroll sa 'Safari Websites' at piliin ang 'While Using the App'.",
                "Bumalik dito at pindutin muli ang 'Detect My Location'. Pindutin ang 'Allow' sa prompt.",
            ],
        },
        safariMacos: {
            heading: "Safari sa Mac",
            steps: [
                "Sa Safari menu bar, piliin ang 'Safari' → 'Settings…' (o 'Preferences…').",
                "Buksan ang 'Websites' tab, tapos piliin ang 'Location' sa kaliwa.",
                "Hanapin ang site na ito at i-set sa 'Allow'.",
                "I-reload ang pahina, tapos i-click muli ang 'Detect My Location'.",
            ],
        },
        firefoxDesktop: {
            heading: "Firefox sa computer",
            steps: [
                "I-click ang lock icon (🔒) sa kaliwa ng address bar.",
                "I-click ang 'Connection secure' → 'More information' → 'Permissions' tab.",
                "Alisin ang block para sa 'Access Your Location' o palitan sa 'Allow'.",
                "I-reload ang pahina at pindutin muli ang 'Detect My Location'.",
            ],
        },
        firefoxAndroid: {
            heading: "Firefox sa Android",
            steps: [
                "Pindutin ang lock icon malapit sa address bar.",
                "Pindutin ang 'Edit site permissions' → 'Location' → 'Allow'.",
                "I-reload ang pahina, tapos pindutin muli ang 'Detect My Location'.",
            ],
        },
        edgeDesktop: {
            heading: "Microsoft Edge",
            steps: [
                "I-click ang lock icon (🔒) sa kaliwa ng address bar.",
                "I-click ang 'Permissions for this site'.",
                "I-set ang 'Location' sa 'Allow'.",
                "I-reload ang pahina at i-click muli ang 'Detect My Location'.",
            ],
        },
        samsung: {
            heading: "Samsung Internet",
            steps: [
                "Pindutin ang lock icon malapit sa address bar.",
                "Pindutin ang 'Permissions' → 'Location' → 'Allow'.",
                "I-reload ang pahina at pindutin muli ang 'Detect My Location'.",
            ],
        },
        iosSettings: {
            heading: "Tingnan din ang Location Services ng iPhone",
            steps: [
                "Buksan ang 'Settings' app ng iPhone.",
                "Pindutin ang 'Privacy & Security' → 'Location Services' at i-ON.",
                "Mag-scroll sa iyong browser (Chrome, Safari, atbp.) at piliin ang 'While Using the App'.",
                "Bumalik dito at pindutin muli ang 'Detect My Location'.",
            ],
        },
        androidSettings: {
            heading: "Tingnan din ang Location settings ng Android",
            steps: [
                "Buksan ang 'Settings' ng telepono.",
                "Pindutin ang 'Location' at siguraduhing naka-ON.",
                "Pindutin ang 'Mode' o 'Location services' at piliin ang 'High accuracy'.",
                "Bumalik dito at pindutin muli ang 'Detect My Location'.",
            ],
        },
        generic: {
            heading: "Iba pang browser",
            steps: [
                "Hanapin ang lock o info icon malapit sa address ng website.",
                "Buksan ang 'Site permissions' o 'Site settings'.",
                "Palitan ang 'Location' sa 'Allow'.",
                "I-reload ang pahina at subukang muli i-detect ang lokasyon.",
            ],
        },
        mapFallback: {
            heading: "O laktawan ang GPS — gamitin ang mapa",
            steps: [
                "Mag-scroll pababa sa mapa.",
                "Pindutin o i-drag ang pin sa tamang lugar sa loob ng lila na outline ng Payatas.",
                "Ipapadala ang ulat gamit ang lokasyong iyon — hindi na kailangan ng GPS.",
            ],
        },
    },
};

export function getStepsForPlatform(platform: PlatformInfo, locale: Locale): StepGroup[] {
    const dict = HELP_TEXT[locale] ?? HELP_TEXT.en;
    const groups: StepGroup[] = [];

    if (platform.isInAppWebView) {
        groups.push(dict.inAppWebView);
        if (platform.os === "ios") groups.push(dict.iosSettings);
        else if (platform.os === "android") groups.push(dict.androidSettings);
        groups.push(dict.mapFallback);
        return groups;
    }

    const { browser, os } = platform;

    if (browser === "chrome") {
        groups.push(os === "android" ? dict.chromeAndroid : dict.chromeDesktop);
    } else if (browser === "safari") {
        groups.push(os === "ios" ? dict.safariIos : dict.safariMacos);
    } else if (browser === "firefox") {
        groups.push(os === "android" ? dict.firefoxAndroid : dict.firefoxDesktop);
    } else if (browser === "edge") {
        groups.push(dict.edgeDesktop);
    } else if (browser === "samsung") {
        groups.push(dict.samsung);
    } else {
        groups.push(dict.generic);
    }

    if (os === "ios" && browser !== "safari") {
        groups.push(dict.iosSettings);
    } else if (os === "android" && (browser === "unknown" || browser === "opera")) {
        groups.push(dict.androidSettings);
    }

    groups.push(dict.mapFallback);
    return groups;
}
