/**
 * Password reset token management
 * Uses a simple in-memory store with expiration (in production, use Redis or database)
 */

import { randomBytes } from "crypto";

interface ResetTokenEntry {
    token: string;
    expiresAt: number;
    used: boolean;
}

// In-memory store - in production, use Redis or database table
const resetTokens = new Map<string, ResetTokenEntry>();

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_LENGTH = 6;

/**
 * Generate a numeric reset token
 */
export async function createPasswordResetToken(userId: string, phone: string): Promise<string> {
    // Generate 6-digit numeric code
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    
    const key = `${userId}:${phone}`;
    
    // Invalidate any existing token
    resetTokens.delete(key);
    
    // Store new token
    resetTokens.set(key, {
        token,
        expiresAt: Date.now() + TOKEN_EXPIRY_MS,
        used: false,
    });

    return token;
}

/**
 * Verify a reset token
 */
export async function verifyPasswordResetToken(userId: string, token: string): Promise<boolean> {
    // Find token by user (we need to iterate since phone might not be known)
    for (const [key, entry] of resetTokens.entries()) {
        if (key.startsWith(`${userId}:`)) {
            if (entry.token === token && !entry.used && Date.now() < entry.expiresAt) {
                // Mark as used
                entry.used = true;
                return true;
            }
            return false;
        }
    }
    return false;
}

/**
 * Clean up expired tokens (call periodically)
 */
export function cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [key, entry] of resetTokens.entries()) {
        if (entry.used || now > entry.expiresAt) {
            resetTokens.delete(key);
        }
    }
}

// Auto-cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
