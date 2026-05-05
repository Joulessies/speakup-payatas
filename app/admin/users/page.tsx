"use client";
import { useState, useEffect } from "react";
import { Loader2, Trash2, Edit, Plus, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface User {
    id: string;
    username: string;
    role: "admin" | "staff" | "user";
    phone?: string;
    created_at: string;
}

export default function AdminUsersPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({ username: "", role: "user", phone: "", password: "" });
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const pageSize = 10;

    const totalPages = Math.ceil(users.length / pageSize);
    const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            const data = await res.json();
            if (!res.ok) {
                toast.error(data?.error || "Failed to load users");
                setUsers([]);
                return;
            }
            setUsers(data.users ?? []);
        } catch {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("User deleted successfully");
                setUsers(users.filter((u) => u.id !== id));
            } else {
                toast.error("Failed to delete user");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleSave = async () => {
        if (!formData.username) {
            toast.error("Username is required");
            return;
        }

        try {
            const method = editingUser ? "PATCH" : "POST";
            const body = editingUser
                ? {
                    id: editingUser.id,
                    role: formData.role,
                    ...(formData.password.trim() ? { password: formData.password.trim() } : {}),
                }
                : { username: formData.username.trim(), role: formData.role, password: formData.password.trim() };

            const res = await fetch("/api/users", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(editingUser ? "User updated" : "User created");
                setIsModalOpen(false);
                loadUsers();
            } else {
                toast.error(data?.error || "Failed to save user");
            }
        } catch {
            toast.error("Network error");
        }
    };

    const openModal = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setFormData({ username: user.username, role: user.role, phone: user.phone || "", password: "" });
        } else {
            setEditingUser(null);
            setFormData({ username: "", role: "user", phone: "", password: "" });
        }
        setIsModalOpen(true);
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Manage Users
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Users are loaded from Supabase (<code className="text-[11px]">app_users</code>). Email accounts need a password; PH mobile uses SMS-style signup (10 digits).
                        </p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Add User
                    </button>
                </div>

                <div className={`rounded-2xl border overflow-hidden shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className={`border-b ${isDark ? "border-white/10 text-white/50 bg-white/[0.02]" : "border-gray-200 text-gray-500 bg-gray-50"}`}>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">ID</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">Username</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px]">Role</th>
                                    <th className="p-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto opacity-50" />
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className={`p-8 text-center border-dashed border ${isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"}`}>
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedUsers.map((u) => (
                                        <tr key={u.id} className={`border-b last:border-0 transition-colors ${isDark ? "border-white/[0.06] hover:bg-white/[0.02]" : "border-gray-100 hover:bg-gray-50"}`}>
                                            <td className={`p-4 font-mono text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                                                {u.id.slice(0, 8)}...
                                            </td>
                                            <td className={`p-4 font-medium ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                                {u.username}
                                                {u.phone && <span className="block text-[10px] opacity-50 font-normal">{u.phone}</span>}
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className={`text-[10px] capitalize ${u.role === "admin" ? "text-red-500 border-red-500/20" : u.role === "staff" ? "text-blue-500 border-blue-500/20" : "text-emerald-500 border-emerald-500/20"}`}>
                                                    {u.role}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => openModal(u)}
                                                    className={`p-2 rounded-lg transition-colors mr-1 ${isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}
                                                    title="Edit User"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(u.id)}
                                                    className="p-2 rounded-lg transition-colors text-red-500 hover:bg-red-500/10"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {users.length > pageSize && (
                    <div className="flex flex-col md:flex-row items-center justify-between pt-4 gap-4">
                        <div className={`text-sm text-center md:text-left ${isDark ? "text-white/50" : "text-gray-500"}`}>
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, users.length)} of {users.length} users
                        </div>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
                            >
                                Prev
                            </button>
                            
                            <div className="flex items-center gap-1 px-1 flex-wrap justify-center">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                                    if (p === 1 || p === totalPages || Math.abs(currentPage - p) <= 1) {
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                                    currentPage === p 
                                                    ? (isDark ? "bg-indigo-500 text-white" : "bg-indigo-500 text-white") 
                                                    : (isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700")
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    }
                                    if (Math.abs(currentPage - p) === 2) {
                                        return <span key={p} className={`px-1 text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>...</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${isDark ? "bg-[#12121a] border border-white/10" : "bg-white border border-gray-100"}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                {editingUser ? "Edit User" : "Add User"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className={`p-1 rounded-md ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                    {editingUser ? "Sign-in (email or +63)" : "Email or PH mobile"}
                                </label>
                                <input
                                    type="text"
                                    readOnly={!!editingUser}
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all ${
                                        isDark ? "bg-[#0a0a0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                                    } ${editingUser ? "opacity-70 cursor-not-allowed" : ""}`}
                                />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                        Password <span className="font-normal opacity-70">(required for email)</span>
                                    </label>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Min 6 characters"
                                        className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all ${
                                            isDark ? "bg-[#0a0a0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                                        }`}
                                    />
                                </div>
                            )}
                            {editingUser && (
                                <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                        New password <span className="font-normal opacity-70">(optional; email accounts only)</span>
                                    </label>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Leave blank to keep current"
                                        className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all ${
                                            isDark ? "bg-[#0a0a0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                                        }`}
                                    />
                                </div>
                            )}
                            <div>
                                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "staff" | "user" })}
                                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all ${
                                        isDark ? "bg-[#0a0a0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                                    }`}
                                >
                                    <option value="user">User</option>
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <button
                                onClick={handleSave}
                                className="w-full py-2.5 mt-2 rounded-xl text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${isDark ? "bg-[#12121a] border border-white/10" : "bg-white border border-gray-100"}`}>
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Trash2 className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Delete User
                                </h2>
                                <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-gray-500"}`}>
                                    Are you sure you want to delete this user? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteTarget)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
