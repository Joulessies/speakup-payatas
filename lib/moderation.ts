/**
 * Content Moderation Module
 * Auto-flags offensive, irrelevant, or spam-like content
 */

// Common offensive words (English + Tagalog) — kept minimal for demo
const OFFENSIVE_PATTERNS = [
    /\b(putang?\s*ina|gago|bobo|tanga|ulol|tang\s*ina)\b/i,
    /\b(f+u+c+k+|sh+i+t+|a+s+s+h+o+l+e|b+i+t+c+h+|d+a+m+n+)\b/i,
    /\b(stupid|idiot|moron|retard)\b/i,
];

// Spam-like patterns
const SPAM_PATTERNS = [
    /(.)\1{5,}/,                          // Repeated characters: "aaaaaaa"
    /\b(test|testing|asdf|qwer|zxcv)\b/i, // Test strings
    /^[.\-_!?@#$%^&*()]+$/,              // Only special characters
    /(http|www\.|\.com|\.net|\.ph)/i,     // URLs/links
];

// Minimum meaningful content
const MIN_DESCRIPTION_WORDS = 2;
const MIN_DESCRIPTION_LENGTH = 8;

export interface ModerationResult {
    flagged: boolean;
    reasons: string[];
    severity: "low" | "medium" | "high";
}

export function moderateContent(description: string): ModerationResult {
    const reasons: string[] = [];
    const trimmed = description.trim();

    // Check for offensive content
    for (const pattern of OFFENSIVE_PATTERNS) {
        if (pattern.test(trimmed)) {
            reasons.push("Contains potentially offensive language");
            break;
        }
    }

    // Check for spam patterns
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(trimmed)) {
            reasons.push("Content matches spam patterns");
            break;
        }
    }

    // Check for too-short/empty content
    if (trimmed.length > 0 && trimmed.length < MIN_DESCRIPTION_LENGTH) {
        reasons.push("Description is too short to be meaningful");
    }

    // Check word count
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (trimmed.length > 0 && wordCount < MIN_DESCRIPTION_WORDS) {
        reasons.push("Description contains too few words");
    }

    // Check for ALL CAPS (more than 10 chars)
    if (trimmed.length > 10 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
        reasons.push("Description is entirely in uppercase");
    }

    // Determine severity
    let severity: ModerationResult["severity"] = "low";
    if (reasons.some((r) => r.includes("offensive"))) {
        severity = "high";
    } else if (reasons.some((r) => r.includes("spam"))) {
        severity = "medium";
    }

    return {
        flagged: reasons.length > 0,
        reasons,
        severity,
    };
}

/**
 * Check if a reporter_hash has been sending repeated spam
 */
export function shouldAutoBlock(
    spamCount: number,
    threshold: number = 3
): boolean {
    return spamCount >= threshold;
}
