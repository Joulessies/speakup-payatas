import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const SALT_LEN = 16;
const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LEN);
    const key = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
    return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt")
        return false;
    try {
        const salt = Buffer.from(parts[1], "base64");
        const expectedKey = Buffer.from(parts[2], "base64");
        const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
        if (derived.length !== expectedKey.length)
            return false;
        return timingSafeEqual(expectedKey, derived);
    }
    catch {
        return false;
    }
}
