import {
    CarFront,
    CircleHelp,
    Droplets,
    FileCheck,
    Flame,
    HandHeart,
    HeartPulse,
    House,
    Leaf,
    LifeBuoy,
    MessageCircleQuestion,
    PawPrint,
    Pill,
    Scale,
    ShieldAlert,
    Stethoscope,
    TrafficCone,
    Trash2,
    UserX,
    Volume2,
    Wrench,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS, resolveCategory, type ReportCategory } from "@/types";

export const CATEGORY_ICONS: Record<ReportCategory, LucideIcon> = {
    safety_concern: ShieldAlert,
    threats_harassment: UserX,
    fire_hazard: Flame,
    medical_health: Stethoscope,
    road_traffic: TrafficCone,
    road_accidents: CarFront,
    noise_nuisance: Volume2,
    electrical_concerns: Zap,
    animal_concerns: PawPrint,
    family_domestic: House,
    substance_concerns: Pill,
    social_welfare: HandHeart,
    legal_mediation: Scale,
    infrastructure: Wrench,
    drainage_flooding: Droplets,
    clearance_concerns: FileCheck,
    service_assistance: LifeBuoy,
    environmental: Leaf,
    garbage_concerns: Trash2,
    sanitation_health: HeartPulse,
    inquiries: MessageCircleQuestion,
    other: CircleHelp,
};

/** Icon for a stored category string, tinted with the category color unless `colored` is false. */
export function CategoryIcon({ category, className, colored = true }: { category: string; className?: string; colored?: boolean }) {
    const key = resolveCategory(category) ?? "other";
    const Icon = CATEGORY_ICONS[key];
    return <Icon aria-hidden className={className} style={colored ? { color: CATEGORY_COLORS[key] } : undefined} />;
}
