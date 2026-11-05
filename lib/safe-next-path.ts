/**
 * Same-site paths only, so a crafted sign-in link can't send the user to another website afterwards.
 * Parsed instead of prefix-checked: browsers read "/\evil.example" and "/<tab>/evil.example" as "//evil.example",
 * and "/.//evil.example" normalizes to it.
 */
export function safeNextPath(value: unknown): string | null {
    if (typeof value !== "string" || !value.startsWith("/"))
        return null;
    try {
        const url = new URL(value, "http://same-site.invalid");
        if (url.host !== "same-site.invalid" || url.pathname.startsWith("//"))
            return null;
        return `${url.pathname}${url.search}${url.hash}`;
    }
    catch {
        return null;
    }
}
