import { type ReportCategory } from "@/types";
import trainedModel from "@/data/trained_ai_model.json";

interface DecisionTree {
    feature: number[];
    threshold: number[];
    children_left: number[];
    children_right: number[];
    value: number[][];
}

interface ModelArtifact {
    model_name: string;
    model_type: string;
    version: string;
    categories: string[];
    vocabulary: Record<string, number>;
    idf: number[];
    forest_trees?: DecisionTree[];
    coefficients: number[][];
    intercepts: number[];
    metrics: {
        accuracy: number;
        macro_f1: number;
        prob_mse: number;
        zero_one_mse: number;
        mape: number;
        total_samples: number;
    };
}

const model = trainedModel as unknown as ModelArtifact;

const FALLBACK_KEYWORDS: Record<Exclude<ReportCategory, "other">, string[]> = {
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

const SLANG_MAP: Record<string, string> = {
    "d2": "dito", "d1": "doon", "jan": "diyan", "dyan": "diyan",
    "wlang": "walang", "wla": "walang", "wala": "walang",
    "brgy": "barangay", "bgy": "barangay",
    "kc": "kasi", "kse": "kasi", "cuz": "kasi", "coz": "kasi",
    "ung": "yung", "bka": "baka", "kht": "kahit", "dpt": "dapat",
    "grbe": "grabe", "pls": "pakiusap", "plz": "pakiusap", "txt": "text",
    "subd": "subdivision", "st": "street", "ave": "avenue",
    "hosp": "ospital", "skwela": "eskwelahan", "skwelahan": "eskwelahan",
    "sched": "schedule", "info": "impormasyon", "govt": "gobyerno",
    "pic": "picture", "ltr": "litro", "sec": "segundo",
    "mins": "minuto", "min": "minuto", "hrs": "oras", "hr": "oras",
    "drange": "drainage", "drain": "drainage", "clog": "clogged",
    "knal": "kanal", "kanall": "kanal", "posste": "poste", "kurynt": "kuryente"
};

function tagalogStem(word: string): string {
    let w = word.toLowerCase().trim();
    if (w.length <= 4) return w;

    const prefixes = [
        "nagkaka", "nakaka", "pinagka", "ipinag", "magpa", "pagka",
        "nagka", "naka", "maki", "naki", "paki", "nag", "mag", "pag",
        "pan", "pam", "pang", "ipa", "ika", "ma", "na", "ka"
    ];
    for (const p of prefixes) {
        if (w.startsWith(p) && w.length - p.length >= 3) {
            w = w.slice(p.length);
            break;
        }
    }

    if (w.length >= 6 && (w.startsWith("bum") || w.startsWith("bin"))) {
        w = w[0] + w.slice(3);
    } else if (w.length >= 7 && (w.slice(1, 3) === "um" || w.slice(1, 3) === "in")) {
        w = w[0] + w.slice(3);
    }

    if (w.length >= 6 && w.slice(0, 2) === w.slice(2, 4)) {
        w = w.slice(2);
    }

    const suffixes = ["han", "hin", "an", "in"];
    for (const s of suffixes) {
        if (w.endsWith(s) && w.length - s.length >= 3) {
            w = w.slice(0, -s.length);
            break;
        }
    }

    return w;
}

function cleanAndNormalizeTokens(text: string): string[] {
    const rawWords = text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[^\w\s\-]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 0);

    const tokens: string[] = [];
    for (const rw of rawWords) {
        const expanded = SLANG_MAP[rw] || rw;
        tokens.push(expanded);
        const stem = tagalogStem(expanded);
        if (stem !== expanded && stem.length >= 3) {
            tokens.push(stem);
        }
    }
    return tokens;
}

function predictTrainedModel(description: string): { category: ReportCategory; confidence: number } | null {
    if (!model || !model.vocabulary || !model.categories || !model.coefficients) {
        return null;
    }

    const words = cleanAndNormalizeTokens(description);
    if (words.length === 0) {
        return null;
    }

    // Extract unigrams and bigrams
    const termCounts: Record<number, number> = {};
    let matchedFeatures = 0;

    for (let i = 0; i < words.length; i++) {
        // Unigram
        const unigram = words[i];
        if (model.vocabulary[unigram] !== undefined) {
            const idx = model.vocabulary[unigram];
            termCounts[idx] = (termCounts[idx] || 0) + 1;
            matchedFeatures++;
        }

        // Bigram
        if (i < words.length - 1) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            if (model.vocabulary[bigram] !== undefined) {
                const idx = model.vocabulary[bigram];
                termCounts[idx] = (termCounts[idx] || 0) + 1;
                matchedFeatures++;
            }
        }
    }

    // If no features matched the trained vocabulary, fall back
    if (matchedFeatures === 0) {
        return null;
    }

    // Compute TF-IDF vector with sublinear tf scaling and L2 normalization
    const tfidfVector: Record<number, number> = {};
    let sumSquares = 0;

    for (const [idxStr, count] of Object.entries(termCounts)) {
        const idx = parseInt(idxStr, 10);
        const sublinearTf = 1 + Math.log(count);
        const idf = model.idf[idx] ?? 1.0;
        const val = sublinearTf * idf;
        tfidfVector[idx] = val;
        sumSquares += val * val;
    }

    const norm = Math.sqrt(sumSquares) || 1.0;
    for (const idxStr of Object.keys(tfidfVector)) {
        const idx = parseInt(idxStr, 10);
        tfidfVector[idx] /= norm;
    }

    let probs: number[];

    // 1. RANDOM FOREST ENSEMBLE EVALUATION (50 Decision Trees)
    if (model.forest_trees && model.forest_trees.length > 0) {
        const numClasses = model.categories.length;
        const sumProbs = new Array(numClasses).fill(0);
        for (const tree of model.forest_trees) {
            let node = 0;
            while (tree.children_left[node] !== -1 && tree.children_right[node] !== -1) {
                const featIdx = tree.feature[node];
                const val = tfidfVector[featIdx] || 0.0;
                if (val <= tree.threshold[node]) {
                    node = tree.children_left[node];
                } else {
                    node = tree.children_right[node];
                }
            }
            const leafProbs = tree.value[node] || [];
            for (let c = 0; c < numClasses; c++) {
                sumProbs[c] += leafProbs[c] || 0.0;
            }
        }
        const nTrees = model.forest_trees.length;
        probs = sumProbs.map(p => p / nTrees);
    } else {
        // Fallback: Softmax dot product
        const logits: number[] = new Array(model.categories.length).fill(0);
        for (let c = 0; c < model.categories.length; c++) {
            let dot = model.intercepts[c] ?? 0;
            const coefRow = model.coefficients[c];
            for (const [idxStr, xVal] of Object.entries(tfidfVector)) {
                const idx = parseInt(idxStr, 10);
                dot += (coefRow[idx] ?? 0) * xVal;
            }
            logits[c] = dot;
        }

        const maxLogit = Math.max(...logits);
        const expVals = logits.map(l => Math.exp(l - maxLogit));
        const sumExp = expVals.reduce((a, b) => a + b, 0) || 1.0;
        probs = expVals.map(e => e / sumExp);
    }

    // Pick argmax category
    let bestIdx = 0;
    let bestProb = probs[0];
    for (let i = 1; i < probs.length; i++) {
        if (probs[i] > bestProb) {
            bestProb = probs[i];
            bestIdx = i;
        }
    }

    const predictedCat = model.categories[bestIdx] as ReportCategory;
    return {
        category: predictedCat,
        confidence: bestProb
    };
}

/**
 * Fallback rule-based keyword heuristic.
 */
function classifyRuleBased(description: string): ReportCategory {
    const text = description.toLowerCase();
    let bestCategory: ReportCategory = "other";
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(FALLBACK_KEYWORDS)) {
        let matchCount = 0;
        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(text)) {
                matchCount++;
            } else if (text.includes(keyword) && keyword.length > 4) {
                matchCount += 0.5;
            }
        }

        if (matchCount > maxMatches) {
            maxMatches = matchCount;
            bestCategory = category as ReportCategory;
        }
    }

    return maxMatches >= 1 ? bestCategory : "other";
}

/**
 * Main public entrypoint: Classifies a citizen report into an official category.
 * Uses the trained Python AI model with calibrated weights.
 */
export function classifyReport(description: string): ReportCategory {
    const res = classifyReportWithConfidence(description);
    return res.category;
}

/**
 * Advanced classification endpoint that also exposes the calibrated confidence score.
 */
export function classifyReportWithConfidence(description: string): {
    category: ReportCategory;
    confidence: number;
    is_ai_trained: boolean;
    model_type: string;
} {
    const trained = predictTrainedModel(description);
    if (trained && trained.confidence >= 0.28) {
        return {
            category: trained.category,
            confidence: trained.confidence,
            is_ai_trained: true,
            model_type: "Random Forest Classifier (50 Trees Ensemble)",
        };
    }

    // Fall back to rule-based keywords if confidence is too low or out-of-vocabulary
    const fallback = classifyRuleBased(description);
    return {
        category: fallback,
        confidence: fallback === "other" ? 0.10 : 0.50,
        is_ai_trained: false,
        model_type: "Rule-Based Keyword Fallback",
    };
}
