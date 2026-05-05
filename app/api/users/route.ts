import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { requireAdminSession } from "@/lib/api-session";
import {
    appUserRowToAdminPayload,
    deleteAppUserById,
    insertEmailUser,
    insertPhoneUser,
    listAllAppUsers,
    isReservedStaffEmail,
    updateAppUserById,
    type AppUserRow,
} from "@/lib/app-users";

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function parsePhoneLast10(raw: string): string | null {
    const d = raw.replace(/\D/g, "");
    if (d.length >= 10)
        return d.slice(-10);
    return null;
}

export async function GET() {
    const gate = await requireAdminSession();
    if (!gate.ok)
        return gate.response;
    try {
        const rows = await listAllAppUsers();
        const users = rows.map((r) => {
            const u = appUserRowToAdminPayload(r);
            const { email: _e, ...rest } = u;
            return rest;
        });
        return NextResponse.json({ users });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load users";
        return NextResponse.json({ error: msg }, { status: 503 });
    }
}

export async function POST(request: Request) {
    const gate = await requireAdminSession();
    if (!gate.ok)
        return gate.response;
    try {
        const body = await request.json();
        const username = String(body?.username ?? "").trim();
        const password = String(body?.password ?? "").trim();
        const role = String(body?.role ?? "user") as AppUserRow["role"];

        if (!username) {
            return NextResponse.json({ error: "Username (email or PH mobile) is required" }, { status: 400 });
        }
        if (!["admin", "staff", "user"].includes(role)) {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }

        if (username.includes("@")) {
            const email = normalizeEmail(username);
            if (isReservedStaffEmail(email)) {
                return NextResponse.json({ error: "Use existing system admin/staff accounts; create a different email." }, { status: 403 });
            }
            if (password.length < 6) {
                return NextResponse.json({ error: "Password must be at least 6 characters for email accounts." }, { status: 400 });
            }
            const hash = await hashPassword(password);
            const row = await insertEmailUser(email, hash, role);
            return NextResponse.json({ success: true, user: appUserRowToAdminPayload(row) }, { status: 201 });
        }

        const phone10 = parsePhoneLast10(username);
        if (!phone10) {
            return NextResponse.json({ error: "Enter a valid email or 10-digit Philippine mobile number." }, { status: 400 });
        }
        const row = await insertPhoneUser(phone10);
        const saved = role !== "user" ? await updateAppUserById(row.id, { role }) : row;
        return NextResponse.json({ success: true, user: appUserRowToAdminPayload(saved) }, { status: 201 });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid request";
        const status = /duplicate|unique/i.test(msg) ? 409 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function PATCH(request: Request) {
    const gate = await requireAdminSession();
    if (!gate.ok)
        return gate.response;
    try {
        const body = await request.json();
        const id = String(body?.id ?? "");
        const role = body?.role as AppUserRow["role"] | undefined;
        const password = body?.password !== undefined ? String(body.password).trim() : undefined;

        if (!id) {
            return NextResponse.json({ error: "Missing user id" }, { status: 400 });
        }

        const rows = await listAllAppUsers();
        const existing = rows.find((r) => r.id === id);
        if (!existing) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (
            existing.email
            && isReservedStaffEmail(existing.email)
            && role !== undefined
            && role !== existing.role
        ) {
            return NextResponse.json({ error: "Cannot change role of built-in admin/staff accounts." }, { status: 403 });
        }

        const updates: { role?: typeof role; passwordPlain?: string } = {};
        if (role !== undefined) {
            if (!["admin", "staff", "user"].includes(role)) {
                return NextResponse.json({ error: "Invalid role" }, { status: 400 });
            }
            updates.role = role;
        }
        if (password !== undefined) {
            if (!existing.email) {
                return NextResponse.json({ error: "Password can only be updated for email-based accounts." }, { status: 400 });
            }
            if (password.length < 6) {
                return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
            }
            updates.passwordPlain = password;
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No updates provided" }, { status: 400 });
        }

        const row = await updateAppUserById(id, updates);
        const { email: _e, ...user } = appUserRowToAdminPayload(row);
        return NextResponse.json({ success: true, user });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid request";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    const gate = await requireAdminSession();
    if (!gate.ok)
        return gate.response;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Missing user id" }, { status: 400 });
        }
        await deleteAppUserById(id);
        return NextResponse.json({ success: true });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed";
        const status = msg.includes("not found") ? 404 : msg.includes("Cannot delete") ? 403 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}
