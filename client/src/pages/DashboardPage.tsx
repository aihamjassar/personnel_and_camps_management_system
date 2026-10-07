import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, Building2, UsersRound, UserRoundCheck, RefreshCw, FileDown, FileSpreadsheet } from "lucide-react";
import { api, ApiError, downloadReport, queryString, type ReportFilters } from "../lib/api";
import type { Summary } from "../lib/types";
import { DataState, Field, inputClass, MetricCard, PageHeader, Panel } from "../components/ui";

const numbers = new Intl.NumberFormat("ar");
const emptyForm = { from: "", to: "", camp_id: "", status: "" };
const statusLabels: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  on_leave: "في إجازة",
  transferred: "منقول",
  discharged: "مسرّح",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyForm);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async (selected: ReportFilters) => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.get<Summary>(`/reports/summary${queryString(selected)}`));
      setAppliedFilters(selected);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل الملخص.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load({}); }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filters.from && filters.to && filters.from > filters.to) {
      setError("يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.");
      return;
    }
    const selected: ReportFilters = {
      ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
      ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
      ...(filters.camp_id ? { camp_id: Number(filters.camp_id) } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    void load(selected);
  }

  function resetFilters() {
    setFilters(emptyForm);
    void load({});
  }

  async function exportAs(format: "xlsx" | "pdf") {
    setExportError(null);
    try {
      await downloadReport(format, appliedFilters);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "تعذّر تصدير التقرير.");
    }
  }

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="نظرة سريعة على السجلات الإدارية المسجلة في النظام." action={<div className="flex flex-wrap items-center gap-2"><button onClick={() => void load(appliedFilters)} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-line bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={16} />تحديث البيانات</button><button onClick={() => void exportAs("xlsx")} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-line bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><FileSpreadsheet size={16} />تصدير Excel</button><button onClick={() => void exportAs("pdf")} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-line bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><FileDown size={16} />تصدير PDF</button></div>} />
      <Panel className="mb-5 p-5">
        <div className="mb-4"><h2 className="font-black text-ink">مرشحات التقرير</h2><p className="mt-1 text-xs leading-5 text-muted">الفترة تخص تاريخ إنشاء سجل الفرد وسجل الانتقال؛ المعسكر والحالة يحددان لقطة الأفراد الحالية.</p></div>
        <form onSubmit={applyFilters} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="إنشاء السجل من"><input type="date" value={filters.from} onChange={(event) => setFilters((old) => ({ ...old, from: event.target.value }))} className={inputClass()} /></Field>
          <Field label="إلى"><input type="date" value={filters.to} onChange={(event) => setFilters((old) => ({ ...old, to: event.target.value }))} className={inputClass()} /></Field>
          <Field label="المعسكر"><select value={filters.camp_id} onChange={(event) => setFilters((old) => ({ ...old, camp_id: event.target.value }))} className={inputClass()}><option value="">كل المعسكرات</option>{summary?.available_camps.map((camp) => <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>)}</select></Field>
          <Field label="الحالة الحالية"><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))} className={inputClass()}><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <div className="flex items-end gap-2"><button type="submit" className="min-h-11 flex-1 rounded-xl bg-brand-600 px-4 text-sm font-black text-white hover:bg-brand-700">تطبيق</button><button type="button" onClick={resetFilters} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">مسح</button></div>
        </form>
      </Panel>
      {exportError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{exportError}</div>}
      <DataState loading={loading} error={error} empty={!summary} onRetry={() => void load(appliedFilters)}>
        {summary && <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="إجمالي الأفراد" value={numbers.format(summary.total_personnel)} hint="السجلات المطابقة للمرشحات" icon={UsersRound} tone="blue" />
            <MetricCard label="الأفراد النشطون" value={numbers.format(summary.active_personnel)} hint="وفق الحالة الحالية للفرد" icon={UserRoundCheck} tone="teal" />
            <MetricCard label="المعسكرات المسجلة" value={numbers.format(summary.by_camp.filter((camp) => camp.camp_id !== null).length)} hint="المعسكرات ضمن النتائج" icon={Building2} tone="violet" />
            <MetricCard label="الحالات غير النشطة" value={numbers.format(Math.max(summary.total_personnel - summary.active_personnel, 0))} hint="تفصيلها أدناه حسب الحالة" icon={Activity} tone="amber" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <Panel className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between"><div><h2 className="font-black text-ink">توزيع الأفراد حسب المعسكر</h2><p className="mt-1 text-xs text-muted">أعداد ملخّصة من سجلات النظام</p></div><span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Building2 size={18} /></span></div>
              {summary.by_camp.length === 0 ? <p className="py-12 text-center text-sm text-muted">لا توجد بيانات توزيع لعرضها بعد.</p> : <div className="space-y-5">{summary.by_camp.map((camp) => {
                const percent = summary.total_personnel > 0 ? Math.min((camp.count / summary.total_personnel) * 100, 100) : 0;
                const capacityPercent = camp.capacity > 0 ? Math.min((camp.count / camp.capacity) * 100, 100) : 0;
                return <div key={camp.camp_id ?? "unassigned"}>
                  <div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{camp.name}</p><p className="mt-0.5 text-xs text-muted">{camp.capacity > 0 ? `السعة ${numbers.format(camp.capacity)} · إشغال ${numbers.format(Math.round(capacityPercent))}٪` : "من دون سعة محددة"}</p></div><span className="shrink-0 text-sm font-black tabular-nums text-ink">{numbers.format(camp.count)}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} /></div>
                </div>;
              })}</div>}
            </Panel>
            <Panel className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between"><div><h2 className="font-black text-ink">التوزيع حسب الرتبة</h2><p className="mt-1 text-xs text-muted">مؤشر مبسط للتوزيع الحالي</p></div><span className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><UsersRound size={18} /></span></div>
              {summary.by_rank.length === 0 ? <p className="py-12 text-center text-sm text-muted">لا توجد بيانات توزيع لعرضها بعد.</p> : <div className="divide-y divide-slate-100">{summary.by_rank.map((rank) => <div key={rank.rank_id ?? "none"} className="flex items-center justify-between gap-3 py-3.5"><div className="flex min-w-0 items-center gap-3"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500" /><span className="truncate text-sm font-semibold text-slate-700">{rank.name}</span></div><span className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-black tabular-nums text-ink">{numbers.format(rank.count)}</span></div>)}</div>}
            </Panel>
          </div>
          <Panel className="p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between"><div><h2 className="font-black text-ink">توزيع الأفراد حسب الحالة</h2><p className="mt-1 text-xs text-muted">الحالة الحالية للسجلات المطابقة</p></div><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Activity size={18} /></span></div>
            {summary.status_breakdown.length === 0 ? <p className="py-8 text-center text-sm text-muted">لا توجد حالات ضمن المرشحات.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{summary.status_breakdown.map((entry) => <div key={entry.status} className="rounded-xl border border-line bg-slate-50/70 p-4"><p className="text-xs font-bold text-muted">{statusLabels[entry.status] ?? entry.status}</p><p className="mt-2 text-xl font-black tabular-nums text-ink">{numbers.format(entry.count)}</p></div>)}</div>}
          </Panel>
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" /><p>هذه اللوحة تعرض بيانات تجريبية لأغراض أكاديمية فقط. لا تستخدمها لاتخاذ قرارات تشغيلية أو لإدخال معلومات حقيقية.</p></div>
        </div>}
      </DataState>
    </>
  );
}
