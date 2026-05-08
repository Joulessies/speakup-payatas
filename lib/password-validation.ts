export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    strength: "weak" | "fair" | "good" | "strong";
    score: number; 
}

export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    } else {
        score++;
    }

    if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter (A-Z)");
    } else {
        score++;
    }

    if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter (a-z)");
    } else {
        score++;
    }

    if (!/\d/.test(password)) {
        errors.push("Password must contain at least one number (0-9)");
    } else {
        score++;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push("Password must contain at least one special character (!@#$%^&* etc.)");
    } else {
        score++;
    }

    const commonPatterns = [
        /^password/i,
        /^123456/,
        /qwerty/i,
        /abc123/i,
        /letmein/i,
        /welcome/i,
        /admin/i,
        /login/i,
    ];

    for (const pattern of commonPatterns) {
        if (pattern.test(password)) {
            errors.push("Password contains common weak patterns - please choose something more unique");
            score = Math.max(0, score - 2);
            break;
        }
    }

    if (/(.)\1{2,}/.test(password)) {
        errors.push("Password contains repeating characters (e.g., 'aaa')");
        score = Math.max(0, score - 1);
    }

    const sequentialPatterns = [
        /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i,
        /123|234|345|456|567|678|789|890/,
        /098|987|876|765|654|543|432|321|210/,
    ];

    for (const pattern of sequentialPatterns) {
        if (pattern.test(password)) {
            errors.push("Password contains sequential characters (e.g., 'abc', '123')");
            score = Math.max(0, score - 1);
            break;
        }
    }

    let strength: PasswordValidationResult["strength"];
    if (score <= 1) {
        strength = "weak";
    } else if (score === 2) {
        strength = "fair";
    } else if (score === 3) {
        strength = "good";
    } else {
        strength = "strong";
    }

    const isValid = password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) &&
        !commonPatterns.some(p => p.test(password));

    return {
        isValid,
        errors,
        strength,
        score,
    };
}

export function getPasswordStrengthColor(strength: PasswordValidationResult["strength"], isDark: boolean): string {
    switch (strength) {
        case "weak":
            return isDark ? "text-red-400" : "text-red-600";
        case "fair":
            return isDark ? "text-orange-400" : "text-orange-600";
        case "good":
            return isDark ? "text-amber-400" : "text-amber-600";
        case "strong":
            return isDark ? "text-emerald-400" : "text-emerald-600";
    }
}

export function getPasswordStrengthBg(strength: PasswordValidationResult["strength"]): string {
    switch (strength) {
        case "weak":
            return "bg-red-500";
        case "fair":
            return "bg-orange-500";
        case "good":
            return "bg-amber-500";
        case "strong":
            return "bg-emerald-500";
    }
}
