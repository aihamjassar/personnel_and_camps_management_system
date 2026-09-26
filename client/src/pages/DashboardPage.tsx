import { useCallback, useEffect, useState } from "react";
import { Activity, Building2, UsersRound, UserRoundCheck, RefreshCw } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Summary } from "../lib/types";
import { DataState, MetricCard, PageHeader, Panel } from "../components/ui";

const numbers = new Intl.NumberFormat("ar");

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.get<Summary>("/reports/summary"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل الملخص.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="نظرة سريعة على السجلات الإدارية المسجلة في النظام." action={<button onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-line bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={16} />تحديث البيانات</button>} />
      <DataState loading={loading} error={error} empty={!summary} onRetry={() => void load()}>
        {summary && <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="إجمالي الأفراد" value={numbers.format(summary.total_personnel)} hint="السجلات النشطة في قاعدة البيانات" icon={UsersRound} tone="blue" />
            <MetricCard label="الأفراد النشطون" value={numbers.format(summary.active_personnel)} hint="وفق الحالة الحالية للفرد" icon={UserRoundCheck} tone="teal" />
            <MetricCard label="المعسكرات المسجلة" value={numbers.format(summary.by_camp.filter((camp) => camp.camp_id !== null).length)} hint="مواقع تجريبية مسجلة" icon={Building2} tone="violet" />
            <MetricCard label="الحالات الأخرى" value={numbers.format(Math.max(summary.total_personnel - summary.active_personnel, 0))} hint="تحتاج إلى مراجعة عند الاقتضاء" icon={Activity} tone="amber" />
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
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" /><p>هذه اللوحة تعرض بيانات تجريبية لأغراض أكاديمية فقط. لا تستخدمها لاتخاذ قرارات تشغيلية أو لإدخال معلومات حقيقية.</p></div>
        </div>}
      </DataState>
    </>
  );
}
