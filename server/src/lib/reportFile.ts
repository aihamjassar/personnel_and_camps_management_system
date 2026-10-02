import fs from "node:fs";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import ArabicReshaper from "arabic-reshaper";

export interface SummaryData {
  total_personnel: number;
  active_personnel: number;
  by_camp: Array<{ camp_id: number | null; name: string; count: number; capacity: number }>;
  by_rank: Array<{ rank_id: number | null; name: string; count: number }>;
  recent_transfers: Array<{
    transfer_id: number;
    requested_at: string | Date;
    status: string;
    reason: string | null;
    personnel: { full_name: string } | null;
    camp_from: { name: string } | null;
    camp_to: { name: string } | null;
  }>;
}

const CAMPS_TITLE = "توزيع الأفراد حسب المعسكر";
const RANKS_TITLE = "التوزيع حسب الرتبة";
const TRANSFERS_TITLE = "آخر الانتقالات";

/** Builds a real .xlsx workbook (Arabic sheet headers included). */
export async function buildXlsx(summary: SummaryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Personnel & Camps (academic)";
  const summarySheet = workbook.addWorksheet("الملخص", { views: [{ rightToLeft: true }] });
  summarySheet.columns = [
    { header: "المؤشر", key: "metric", width: 30 },
    { header: "القيمة", key: "value", width: 15 },
  ];
  summarySheet.addRow({ metric: "إجمالي الأفراد", value: summary.total_personnel });
  summarySheet.addRow({ metric: "الأفراد النشطون", value: summary.active_personnel });
  summarySheet.getRow(1).font = { bold: true };

  const campsSheet = workbook.addWorksheet("حسب المعسكر", { views: [{ rightToLeft: true }] });
  campsSheet.columns = [
    { header: "المعسكر", key: "name", width: 28 },
    { header: "العدد", key: "count", width: 10 },
    { header: "السعة", key: "capacity", width: 10 },
  ];
  for (const camp of summary.by_camp) campsSheet.addRow({ name: camp.name, count: camp.count, capacity: camp.capacity });
  campsSheet.getRow(1).font = { bold: true };

  const ranksSheet = workbook.addWorksheet("حسب الرتبة", { views: [{ rightToLeft: true }] });
  ranksSheet.columns = [
    { header: "الرتبة", key: "name", width: 28 },
    { header: "العدد", key: "count", width: 10 },
  ];
  for (const rank of summary.by_rank) ranksSheet.addRow({ name: rank.name, count: rank.count });
  ranksSheet.getRow(1).font = { bold: true };

  const transfersSheet = workbook.addWorksheet("آخر الانتقالات", { views: [{ rightToLeft: true }] });
  transfersSheet.columns = [
    { header: "الفرد", key: "person", width: 25 },
    { header: "من", key: "from", width: 20 },
    { header: "إلى", key: "to", width: 20 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "التاريخ", key: "date", width: 22 },
  ];
  for (const t of summary.recent_transfers) {
    transfersSheet.addRow({
      person: t.personnel?.full_name ?? "—",
      from: t.camp_from?.name ?? "—",
      to: t.camp_to?.name ?? "—",
      status: t.status,
      date: new Date(t.requested_at).toLocaleString("ar"),
    });
  }
  transfersSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Reshapes a line of text so pdfkit (which has no Arabic shaping) can render it:
 * reshape Arabic runs, reverse each Arabic word, and reverse token order because
 * Arabic paragraphs are right-to-left while pdfkit lays runs out left-to-right.
 */
function arabicLine(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((word) => (/[؀-ۿ]/.test(word) ? [...ArabicReshaper.convertArabic(word)].reverse().join("") : word))
    .join(" ");
}

function resolveArabicFont(): string | undefined {
  const candidates = [
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\tahoma.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
  ];
  return candidates.find((p) => fs.existsSync(p));
}

/** Builds a minimal PDF respecting Arabic shaping. */
export async function buildPdf(summary: SummaryData): Promise<Buffer> {
  const fontPath = resolveArabicFont();
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  if (fontPath) doc.registerFont("arabic", fontPath).font("arabic");

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(18).text(arabicLine("تقرير ملخص النظام — نسخة أكاديمية"), { align: "right" });
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(arabicLine(`إجمالي الأفراد: ${summary.total_personnel}`), { align: "right" });
  doc.text(arabicLine(`الأفراد النشطون: ${summary.active_personnel}`), { align: "right" });
  doc.moveDown();

  doc.fontSize(14).text(arabicLine(CAMPS_TITLE), { align: "right" });
  doc.fontSize(11);
  for (const camp of summary.by_camp) {
    doc.text(arabicLine(`- ${camp.name}: ${camp.count} (السعة ${camp.capacity})`), { align: "right" });
  }
  doc.moveDown();

  doc.fontSize(14).text(arabicLine(RANKS_TITLE), { align: "right" });
  doc.fontSize(11);
  for (const rank of summary.by_rank) {
    doc.text(arabicLine(`- ${rank.name}: ${rank.count}`), { align: "right" });
  }
  doc.moveDown();

  doc.fontSize(14).text(arabicLine(TRANSFERS_TITLE), { align: "right" });
  doc.fontSize(11);
  for (const t of summary.recent_transfers) {
    doc.text(
      arabicLine(
        `- ${t.personnel?.full_name ?? "—"} | ${t.camp_from?.name ?? "—"} <- ${t.camp_to?.name ?? "—"} | ${t.status}`,
      ),
      { align: "right" },
    );
  }

  doc.end();
  return done;
}
