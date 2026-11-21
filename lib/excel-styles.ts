import type ExcelJS from "exceljs";
import { sanitizeExcelCell } from "@/lib/logbook";

export const EXCEL_PALETTE = {
    // Official Payatas Green / QC Emerald
    EMERALD_900: "FF064E3B", // Darkest emerald for title banner
    EMERALD_800: "FF065F46", // Dark emerald for subtitle
    EMERALD_700: "FF047857", // Primary header background
    EMERALD_600: "FF059669", // Accent emerald
    EMERALD_100: "FFD1FAE5", // Subtitle text tint
    EMERALD_50: "FFF0FDF4",  // Metadata chip fill
    
    // Neutrals
    WHITE: "FFFFFFFF",
    SLATE_900: "FF0F172A",
    SLATE_800: "FF1E293B",
    SLATE_700: "FF334155",
    SLATE_600: "FF475569",
    SLATE_500: "FF64748B",
    SLATE_200: "FFE2E8F0",
    SLATE_100: "FFF1F5F9",
    SLATE_50: "FFF8FAFC",   // Zebra odd row fill

    // Badges: Status
    STATUS_RESOLVED_BG: "FFDCFCE7",
    STATUS_RESOLVED_FG: "FF166534",
    STATUS_PROGRESS_BG: "FFFEF3C7",
    STATUS_PROGRESS_FG: "FF92400E",
    STATUS_PENDING_BG: "FFFEE2E2",
    STATUS_PENDING_FG: "FF991B1B",
    STATUS_VERIFIED_BG: "FFE0E7FF",
    STATUS_VERIFIED_FG: "FF3730A3",

    // Badges: Urgency
    URGENCY_HIGH_BG: "FFFEE2E2",
    URGENCY_HIGH_FG: "FFB91C1C",
    URGENCY_MED_BG: "FFFEF3C7",
    URGENCY_MED_FG: "FFB45309",
    URGENCY_LOW_BG: "FFF1F5F9",
    URGENCY_LOW_FG: "FF475569",
};

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: EXCEL_PALETTE.SLATE_200 } },
    left: { style: "thin", color: { argb: EXCEL_PALETTE.SLATE_200 } },
    bottom: { style: "thin", color: { argb: EXCEL_PALETTE.SLATE_200 } },
    right: { style: "thin", color: { argb: EXCEL_PALETTE.SLATE_200 } },
};

export const HEADER_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: EXCEL_PALETTE.EMERALD_800 } },
    left: { style: "thin", color: { argb: EXCEL_PALETTE.EMERALD_800 } },
    bottom: { style: "medium", color: { argb: EXCEL_PALETTE.EMERALD_900 } },
    right: { style: "thin", color: { argb: EXCEL_PALETTE.EMERALD_800 } },
};

export type ColumnConfig = {
    header: string;
    width: number;
    align?: "left" | "center" | "right";
    wrapText?: boolean;
    type?: "text" | "status" | "urgency" | "date" | "number";
};

export function colToLetter(col: number): string {
    let temp: number;
    let letter = "";
    let c = col;
    while (c > 0) {
        temp = (c - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        c = Math.floor((c - temp - 1) / 26);
    }
    return letter;
}

export function getStatusBadge(val: string): { bg: string; fg: string } {
    const v = val.toUpperCase();
    if (v.includes("RESOLV") || v.includes("RESPOND")) {
        return { bg: EXCEL_PALETTE.STATUS_RESOLVED_BG, fg: EXCEL_PALETTE.STATUS_RESOLVED_FG };
    }
    if (v.includes("PROGRESS") || v.includes("TRANSFER")) {
        return { bg: EXCEL_PALETTE.STATUS_PROGRESS_BG, fg: EXCEL_PALETTE.STATUS_PROGRESS_FG };
    }
    if (v.includes("PENDING")) {
        return { bg: EXCEL_PALETTE.STATUS_PENDING_BG, fg: EXCEL_PALETTE.STATUS_PENDING_FG };
    }
    if (v.includes("VERIF")) {
        return { bg: EXCEL_PALETTE.STATUS_VERIFIED_BG, fg: EXCEL_PALETTE.STATUS_VERIFIED_FG };
    }
    return { bg: EXCEL_PALETTE.SLATE_100, fg: EXCEL_PALETTE.SLATE_700 };
}

export function getUrgencyBadge(val: string): { bg: string; fg: string } {
    const v = val.toUpperCase();
    if (v === "HIGH" || v.includes("CRITICAL") || v.includes("HIGH")) {
        return { bg: EXCEL_PALETTE.URGENCY_HIGH_BG, fg: EXCEL_PALETTE.URGENCY_HIGH_FG };
    }
    if (v === "MEDIUM" || v.includes("MED")) {
        return { bg: EXCEL_PALETTE.URGENCY_MED_BG, fg: EXCEL_PALETTE.URGENCY_MED_FG };
    }
    return { bg: EXCEL_PALETTE.URGENCY_LOW_BG, fg: EXCEL_PALETTE.URGENCY_LOW_FG };
}

/**
 * Applies the official Quezon City / Barangay Payatas banner at Rows 1 to 3
 */
export function applyGovernmentBanner(
    ws: ExcelJS.Worksheet,
    options: {
        title?: string;
        subtitle?: string;
        meta?: string;
        totalCols: number;
    }
) {
    const colCount = Math.max(options.totalCols, 12);
    const endColLetter = colToLetter(colCount);

    // Row 1: Republic & LGU Title
    ws.mergeCells(`A1:${endColLetter}1`);
    const r1 = ws.getCell("A1");
    r1.value = options.title || "BARANGAY PAYATAS • QUEZON CITY • INCIDENT & COMPLAINT MONITORING SYSTEM";
    r1.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
    r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_900 } };
    r1.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 32;

    // Row 2: Subtitle
    ws.mergeCells(`A2:${endColLetter}2`);
    const r2 = ws.getCell("A2");
    r2.value = options.subtitle || "Emergency Operations Center (EOC) • SpeakUp Payatas Official Record";
    r2.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: EXCEL_PALETTE.EMERALD_100 } };
    r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_800 } };
    r2.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(2).height = 20;

    // Row 3: Metadata chip bar
    ws.mergeCells(`A3:${endColLetter}3`);
    const r3 = ws.getCell("A3");
    r3.value = options.meta || `Exported on: ${new Date().toISOString()} | All confidential records protected`;
    r3.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: EXCEL_PALETTE.EMERALD_900 } };
    r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_50 } };
    r3.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r3.border = { bottom: { style: "thin", color: { argb: "FFA7F3D0" } } };
    ws.getRow(3).height = 20;

    // Row 4: Spacer row
    ws.getRow(4).height = 8;
}

/**
 * Sets styled headers and enables Freeze Pane + AutoFilter
 */
export function applyTableHeaders(
    ws: ExcelJS.Worksheet,
    rowIndex: number,
    columns: ColumnConfig[]
) {
    const row = ws.getRow(rowIndex);
    row.height = 30;

    columns.forEach((col, idx) => {
        const colNum = idx + 1;
        const cell = row.getCell(colNum);
        cell.value = col.header;
        cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_700 } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = HEADER_BORDER;

        // Set column width with padding
        ws.getColumn(colNum).width = Math.max(col.width, 10);
    });

    // Auto-filter on header row
    ws.autoFilter = {
        from: { row: rowIndex, column: 1 },
        to: { row: rowIndex, column: columns.length },
    };

    // Freeze panes: Keep Rows 1 to rowIndex fixed when scrolling
    ws.views = [
        {
            state: "frozen",
            xSplit: 0,
            ySplit: rowIndex,
            topLeftCell: `A${rowIndex + 1}`,
            activeCell: `A${rowIndex + 1}`,
        },
    ];
}

/**
 * Styles a single data row with zebra fills, borders, and pills
 */
export function styleDataRow(
    row: ExcelJS.Row,
    dataRowIdx: number,
    columns: ColumnConfig[],
    values: unknown[]
) {
    row.height = 24;
    const isOdd = dataRowIdx % 2 === 1;
    const bgZebra = isOdd ? EXCEL_PALETTE.SLATE_50 : EXCEL_PALETTE.WHITE;

    values.forEach((val, colIdx) => {
        const colNum = colIdx + 1;
        const cell = row.getCell(colNum);
        const colConf = columns[colIdx] || { align: "left" };

        const safeVal = sanitizeExcelCell(val);
        cell.value = safeVal === "" && val !== "" ? null : safeVal;

        cell.font = { name: "Segoe UI", size: 10, color: { argb: EXCEL_PALETTE.SLATE_800 } };
        cell.border = THIN_BORDER;

        const strVal = String(safeVal ?? "").toUpperCase().trim();

        if (colConf.type === "status" && strVal) {
            const badge = getStatusBadge(strVal);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: badge.bg } };
            cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: badge.fg } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colConf.type === "urgency" && strVal) {
            const badge = getUrgencyBadge(strVal);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: badge.bg } };
            cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: badge.fg } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgZebra } };
            cell.alignment = {
                vertical: "middle",
                horizontal: colConf.align || "left",
                wrapText: Boolean(colConf.wrapText),
            };
            if (colConf.type === "date" || colConf.type === "number") {
                cell.alignment.horizontal = "center";
            }
        }
    });
}

/**
 * Creates an executive KPI summary card on the worksheet
 */
export function createKpiCard(
    ws: ExcelJS.Worksheet,
    startCell: string,
    endCell: string,
    value: string | number,
    label: string,
    options: {
        valColor?: string;
        bgColor?: string;
        borderColor?: string;
    } = {}
) {
    ws.mergeCells(`${startCell}:${endCell}`);
    const topCell = ws.getCell(startCell);

    topCell.value = {
        richText: [
            {
                text: `${value}\n`,
                font: {
                    name: "Segoe UI",
                    size: 20,
                    bold: true,
                    color: { argb: options.valColor || EXCEL_PALETTE.EMERALD_900 },
                },
            },
            {
                text: label.toUpperCase(),
                font: {
                    name: "Segoe UI",
                    size: 9,
                    bold: true,
                    color: { argb: EXCEL_PALETTE.SLATE_600 },
                },
            },
        ],
    };

    topCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: options.bgColor || EXCEL_PALETTE.EMERALD_50 },
    };
    topCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    const bColor = options.borderColor || EXCEL_PALETTE.EMERALD_700;
    const cardBorder: Partial<ExcelJS.Borders> = {
        top: { style: "medium", color: { argb: bColor } },
        left: { style: "medium", color: { argb: bColor } },
        bottom: { style: "medium", color: { argb: bColor } },
        right: { style: "medium", color: { argb: bColor } },
    };
    topCell.border = cardBorder;
}

/**
 * Creates a formatted summary table for the Executive Analytics Dashboard
 */
export function createSummaryTable(
    ws: ExcelJS.Worksheet,
    options: {
        startRow: number;
        startCol: number;
        title: string;
        headers: [string, string, string];
        colWidths: [number, number, number];
        rows: [string, number, string][];
        totalCount: number;
    }
): number {
    const { startRow, startCol, title, headers, colWidths, rows, totalCount } = options;
    const endCol = startCol + 2;
    const startLetter = colToLetter(startCol);
    const endLetter = colToLetter(endCol);

    // Set widths
    colWidths.forEach((w, idx) => {
        const colNum = startCol + idx;
        const col = ws.getColumn(colNum);
        if (!col.width || col.width < w) {
            col.width = w;
        }
    });

    // 1. Table Title Banner
    ws.mergeCells(`${startLetter}${startRow}:${endLetter}${startRow}`);
    const titleCell = ws.getCell(`${startLetter}${startRow}`);
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_800 } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.border = HEADER_BORDER;
    ws.getRow(startRow).height = 24;

    // 2. Table Column Headers
    const hRowIdx = startRow + 1;
    const hRow = ws.getRow(hRowIdx);
    hRow.height = 22;
    headers.forEach((hText, idx) => {
        const cell = hRow.getCell(startCol + idx);
        cell.value = hText;
        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: EXCEL_PALETTE.WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_700 } };
        cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : "center" };
        cell.border = HEADER_BORDER;
    });

    // 3. Data Rows
    let curRowIdx = startRow + 2;
    rows.forEach(([label, count, pct], rIdx) => {
        const row = ws.getRow(curRowIdx);
        row.height = 20;
        const isOdd = rIdx % 2 === 1;
        const bgZebra = isOdd ? EXCEL_PALETTE.SLATE_50 : EXCEL_PALETTE.WHITE;

        const c1 = row.getCell(startCol);
        c1.value = label;
        c1.font = { name: "Segoe UI", size: 9.5, color: { argb: EXCEL_PALETTE.SLATE_800 } };
        c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgZebra } };
        c1.alignment = { vertical: "middle", horizontal: "left" };
        c1.border = THIN_BORDER;

        const c2 = row.getCell(startCol + 1);
        c2.value = count;
        c2.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: EXCEL_PALETTE.SLATE_800 } };
        c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgZebra } };
        c2.alignment = { vertical: "middle", horizontal: "center" };
        c2.border = THIN_BORDER;

        const c3 = row.getCell(startCol + 2);
        c3.value = pct;
        c3.font = { name: "Segoe UI", size: 9.5, color: { argb: EXCEL_PALETTE.SLATE_600 } };
        c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgZebra } };
        c3.alignment = { vertical: "middle", horizontal: "right" };
        c3.border = THIN_BORDER;

        curRowIdx++;
    });

    // 4. Total Row
    const tRow = ws.getRow(curRowIdx);
    tRow.height = 22;
    const totalBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: EXCEL_PALETTE.EMERALD_700 } },
        left: { style: "thin", color: { argb: EXCEL_PALETTE.SLATE_200 } },
        bottom: { style: "double", color: { argb: EXCEL_PALETTE.EMERALD_900 } },
        right: { style: "thin", color: { argb: EXCEL_PALETTE.SLATE_200 } },
    };

    const tc1 = tRow.getCell(startCol);
    tc1.value = "TOTAL";
    tc1.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: EXCEL_PALETTE.EMERALD_900 } };
    tc1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_50 } };
    tc1.alignment = { vertical: "middle", horizontal: "left" };
    tc1.border = totalBorder;

    const tc2 = tRow.getCell(startCol + 1);
    tc2.value = totalCount;
    tc2.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: EXCEL_PALETTE.EMERALD_900 } };
    tc2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_50 } };
    tc2.alignment = { vertical: "middle", horizontal: "center" };
    tc2.border = totalBorder;

    const tc3 = tRow.getCell(startCol + 2);
    tc3.value = "100%";
    tc3.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: EXCEL_PALETTE.EMERALD_900 } };
    tc3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_PALETTE.EMERALD_50 } };
    tc3.alignment = { vertical: "middle", horizontal: "right" };
    tc3.border = totalBorder;

    return curRowIdx + 1;
}
