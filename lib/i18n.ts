export type Locale = "en" | "fil";

const translations = {
  en: {
    // Nav
    navReport: "Report",
    navMap: "Map",
    navAnalytics: "Analytics",
    navTrack: "Track",

    // Report form
    reportTitle: "Report an Incident",
    reportAnonymousId: "Anonymous ID",
    reportOnline: "Online",
    reportOffline: "Offline",
    reportPendingQueue: (n: number) =>
      `${n} report${n > 1 ? "s" : ""} queued — will sync when online`,
    reportSubmitted: "Report Submitted",
    reportSentSecurely: "Sent securely to the system.",
    reportSavedOffline: "Saved offline — will sync automatically.",
    reportWhatHappened: "What happened?",
    reportDescription: "Description",
    reportDescriptionPlaceholder: "Describe what happened…",
    reportSeverity: "Severity",
    reportLocation: "Location",
    reportDetectLocation: "Detect My Location",
    reportDetecting: "Detecting…",
    reportTapRefresh: "tap to refresh",
    reportPhoto: "Photo Evidence",
    reportAddPhoto: "Add Photo",
    reportChangePhoto: "Change",
    reportSubmit: "Submit Report",
    reportSaveOffline: "Save Offline",
    reportSubmitting: "Submitting…",
    reportSelectCategory: "Please select a category.",
    reportDetectGPS: "Please detect your GPS location.",
    reportGPSNotSupported: "GPS is not supported on this device.",

    // Categories
    catFlooding: "Flooding",
    catFire: "Fire",
    catCrime: "Crime",
    catInfrastructure: "Infra",
    catHealth: "Health",
    catEnvironmental: "Environ",
    catOther: "Other",

    // Severity
    sevLow: "Low",
    sevMinor: "Minor",
    sevModerate: "Moderate",
    sevHigh: "High",
    sevCritical: "Critical",

    // Branding
    brandName: "SpeakUp Payatas (D2)",
    brandLocation: "Payatas, Quezon City (District 2)",
    brandDescription:
      "Report incidents anonymously. Your identity is protected with SHA-256 encryption.",

    // Track
    trackTitle: "Track Your Report",
    trackDescription:
      "Enter your Anonymous ID to check the status of your reports.",
    trackPlaceholder: "Paste your Anonymous ID hash…",
    trackSearch: "Search",
    trackSearching: "Searching…",
    trackNoResults: "No reports found for this ID.",
    trackReports: "Your Reports",
    trackPending: "Pending",
    trackVerified: "Verified",
    trackResolved: "Resolved",
    trackSubmitted: "Submitted",
    trackInProgress: "In Progress",
    trackUseMyId: "Use my device Anonymous ID",
    trackClear: "Clear",
    trackTip: "Tip: You can paste your full hash or the first 8+ characters.",
    trackResultsFor: (_query: string) => "Results for:",
    trackMinCharsError: "Please enter at least 8 characters of your Anonymous ID.",
    trackSearchFailedError: "Could not fetch reports right now. Please try again.",
    trackConfirmReport: "Confirm this report",

    // Admin
    adminOverview: "Overview",
    adminReports: "Reports",
    adminHotspots: "Hotspots",
    adminScattered: "Scattered",
    adminFilterCategory: "Filter by Category",
    adminHotspotsCount: (n: number) => `Hotspots (${n})`,
    adminNoMatch: "No clusters match your filters.",
    adminDensityLegend: "Density Legend",
    adminExportCSV: "Export CSV",
    adminDensityLow: "Low (< 5 reports)",
    adminDensityMedium: "Medium (5–9)",
    adminDensityHigh: "High (10–14)",
    adminDensityCritical: "Critical (15+)",

    // Toast
    toastSyncComplete: (n: number) =>
      `${n} report${n > 1 ? "s" : ""} synced successfully`,
    toastReportSubmitted: "Report submitted successfully",
    toastSavedOffline: "Report saved offline",
    toastSyncFailed: "Some reports failed to sync",
  },
  fil: {
    // Nav
    navReport: "Ulat",
    navMap: "Mapa",
    navAnalytics: "Analitika",
    navTrack: "Subaybay",

    // Report form
    reportTitle: "Mag-ulat ng Insidente",
    reportAnonymousId: "Anonymous ID",
    reportOnline: "Online",
    reportOffline: "Offline",
    reportPendingQueue: (n: number) =>
      `${n} ulat na naka-save — masi-sync kapag may internet`,
    reportSubmitted: "Naipadala ang Ulat",
    reportSentSecurely: "Ligtas na naipadala sa sistema.",
    reportSavedOffline: "Na-save offline — awtomatikong masi-sync.",
    reportWhatHappened: "Ano ang nangyari?",
    reportDescription: "Deskripsyon",
    reportDescriptionPlaceholder: "Ilarawan ang nangyari…",
    reportSeverity: "Kalubhaan",
    reportLocation: "Lokasyon",
    reportDetectLocation: "I-detect ang Lokasyon",
    reportDetecting: "Dine-detect…",
    reportTapRefresh: "pindutin para i-refresh",
    reportPhoto: "Ebidensyang Litrato",
    reportAddPhoto: "Magdagdag ng Litrato",
    reportChangePhoto: "Palitan",
    reportSubmit: "Ipadala ang Ulat",
    reportSaveOffline: "I-save Offline",
    reportSubmitting: "Ipinapadala…",
    reportSelectCategory: "Pumili ng kategorya.",
    reportDetectGPS: "I-detect muna ang lokasyon.",
    reportGPSNotSupported: "Hindi sinusuportahan ang GPS sa device na ito.",

    // Categories
    catFlooding: "Baha",
    catFire: "Sunog",
    catCrime: "Krimen",
    catInfrastructure: "Infra",
    catHealth: "Kalusugan",
    catEnvironmental: "Kalikasan",
    catOther: "Iba pa",

    // Severity
    sevLow: "Mababa",
    sevMinor: "Bahagya",
    sevModerate: "Katamtaman",
    sevHigh: "Mataas",
    sevCritical: "Kritikal",

    // Branding
    brandName: "SpeakUp Payatas (D2)",
    brandLocation: "Payatas, Lungsod Quezon (District 2)",
    brandDescription:
      "Mag-ulat ng insidente nang hindi nagpapakilala. Protektado ang iyong pagkakakilanlan gamit ang SHA-256.",

    // Track
    trackTitle: "Subaybayan ang Ulat",
    trackDescription:
      "Ilagay ang iyong Anonymous ID para makita ang katayuan ng iyong ulat.",
    trackPlaceholder: "I-paste ang iyong Anonymous ID hash…",
    trackSearch: "Hanapin",
    trackSearching: "Hinahanap…",
    trackNoResults: "Walang nakitang ulat para sa ID na ito.",
    trackReports: "Ang Iyong mga Ulat",
    trackPending: "Naghihintay",
    trackVerified: "Na-verify",
    trackResolved: "Nalutas",
    trackSubmitted: "Naipasa",
    trackInProgress: "Inaaksyunan",
    trackUseMyId: "Gamitin ang Anonymous ID ng device ko",
    trackClear: "I-clear",
    trackTip: "Tip: Maaari mong i-paste ang buong hash o unang 8+ character.",
    trackResultsFor: (_query: string) => "Mga resulta para sa:",
    trackMinCharsError: "Maglagay ng hindi bababa sa 8 character ng iyong Anonymous ID.",
    trackSearchFailedError: "Hindi makuha ang mga ulat ngayon. Pakisubukang muli.",
    trackConfirmReport: "Kumpirmahin ang ulat na ito",

    // Admin
    adminOverview: "Buod",
    adminReports: "Ulat",
    adminHotspots: "Hotspot",
    adminScattered: "Kumalat",
    adminFilterCategory: "I-filter ayon sa Kategorya",
    adminHotspotsCount: (n: number) => `Mga Hotspot (${n})`,
    adminNoMatch: "Walang tumutugma sa iyong filter.",
    adminDensityLegend: "Lagenda ng Density",
    adminExportCSV: "I-export CSV",
    adminDensityLow: "Mababa (< 5 ulat)",
    adminDensityMedium: "Katamtaman (5–9)",
    adminDensityHigh: "Mataas (10–14)",
    adminDensityCritical: "Kritikal (15+)",

    // Toast
    toastSyncComplete: (n: number) =>
      `${n} ulat na matagumpay na na-sync`,
    toastReportSubmitted: "Matagumpay na naipadala ang ulat",
    toastSavedOffline: "Na-save ang ulat offline",
    toastSyncFailed: "May mga ulat na hindi na-sync",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function getTranslations(locale: Locale) {
  return translations[locale];
}

export type Translations = ReturnType<typeof getTranslations>;
