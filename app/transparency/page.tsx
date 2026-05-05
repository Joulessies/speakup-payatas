import TransparencyBoard from "@/components/transparency-board";
import { Eye, ShieldCheck } from "lucide-react";

export default function TransparencyPage() {
    return (
        <div className="flex flex-col h-full overflow-y-auto bg-gray-50 dark:bg-[#0a0a0f]">
            <div className="max-w-6xl mx-auto w-full px-4 py-8 md:px-8 md:py-12 space-y-8">
                <div className="text-center max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/15">
                            <Eye className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/15">
                            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Public Transparency Board
                    </h1>
                    <p className="text-gray-500 dark:text-white/50 leading-relaxed">
                        Track how the barangay is resolving community issues. This board displays all successfully resolved reports. For privacy, reporter identities and exact coordinates are hidden.
                    </p>
                </div>

                <TransparencyBoard />
            </div>
        </div>
    );
}
