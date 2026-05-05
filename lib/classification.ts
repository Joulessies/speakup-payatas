import { type ReportCategory } from "@/types";

/**
 * Basic Rule-Based NLP Classification Algorithm
 * Assigns an AI category based on keyword density in the report description.
 * Supports both English and Tagalog phrasing.
 */

const CATEGORY_KEYWORDS: Record<Exclude<ReportCategory, "other">, string[]> = {
    drainage_flooding: [
        "flood", "flooding", "baha", "bumabaha", "lubog", "tubig", 
        "drainage", "kanal", "clogged", "barado", "estero"
    ],
    fire_hazard: [
        "fire", "sunog", "spark", "sparking", "usok", "smoke", 
        "wire", "kuryente", "electrical", "poste", "lpg", "gas"
    ],
    safety_concern: [
        "crime", "krimen", "magnanakaw", "robbery", "theft", "snatcher",
        "suspicious", "kahina-hinala", "away", "fight", "tambay", "gulo",
        "accident", "aksidente"
    ],
    infrastructure: [
        "road", "daan", "kalsada", "pothole", "lubak", "sira", "broken",
        "bridge", "tulay", "light", "ilaw", "poste", "crack", "collapsed"
    ],
    sanitation_health: [
        "dengue", "disease", "sakit", "health", "kalusugan", 
        "garbage", "basura", "kalat", "smell", "mabaho", "rat", "daga", "lamok"
    ],
    environmental: [
        "pollution", "polusyon", "tree", "puno", "landslide", "guho",
        "erosion", "burn", "sunog basura", "chemical", "spill"
    ],
    noise_nuisance: [
        "noise", "ingay", "maingay", "loud", "music", "karaoke", 
        "videoke", "party", "construction", "gabi", "disturbance"
    ]
};

export function classifyReport(description: string): ReportCategory {
    const text = description.toLowerCase();
    
    let bestCategory: ReportCategory = "other";
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        let matchCount = 0;
        
        for (const keyword of keywords) {
            // Use regex to match whole words or boundaries
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(text)) {
                matchCount++;
            } else if (text.includes(keyword) && keyword.length > 4) {
                // Fallback for partial matches on longer words
                matchCount += 0.5;
            }
        }

        if (matchCount > maxMatches) {
            maxMatches = matchCount;
            bestCategory = category as ReportCategory;
        }
    }

    // If confidence is too low, default to 'other'
    if (maxMatches < 1) {
        return "other";
    }

    return bestCategory;
}
