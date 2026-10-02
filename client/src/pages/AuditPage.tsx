import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Button, DataState, DataTable, Field, PageHeader, Panel } from "../components/ui";

interface AuditItem {
  log_id: number;
  user_id: number | null;
  action_type: string;
  target_table: string;
  target_id: number | null;
  ip_address: string | null;
  created_at: string;
  user: { user_id: number; username: string; full_name: string } | null;
}

const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

export default function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    if (actionType.trim()) params.set("action_type", actionType.trim());
    if (targetTable.trim()) params.set("target_table", targetTable.trim());
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    try {
      const result = await api.get<{ items: AuditItem[]; total: number }>(`/audit?${params.toString()}`);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل سجلات التدقيق.");
    } finally {
      setLoading(false);
    }
  }, [userId, actionType, targetTable, from, to]);

  useEffect(() => { void load(); }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  return (
    <>
      <PageHeader title="سجل التدقيق" subtitle="مراجعة الأنشطة الحرجة بصلاحيات مدير النظام فقط. السجل للقراءة فقط ولا يُعدَّل." />
      <Panel>
        <form onSubmit={applyFilters} className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="رقم المستخدم"><input className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm" inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))} placeholder="مثال: 1" /></Field>
          <Field label="نوع العملية"><input className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm" value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="TransferCompleted" /></Field>
          <Field label="الجدول المستهدف"><input className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm" value={targetTable} onChange={(e) => setTargetTable(e.target.value)} placeholder="Transfers" /></Field>
          <Field label="من تاريخ"><input type="datetime-local" className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="إلى تاريخ"><input type="datetime-local" className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex items-end sm:col-span-2 xl:col-span-5"><Button type="submit">تطبيق الفلترة</Button></div>
        </form>
        <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} onRetry={() => void load()}>
          <DataTable><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>الجدول</th><th>المعرف</th><th>IP</th></tr></thead><tbody>
            {items.map((item) => <tr key={item.log_id}><td>{dateFmt.format(new Date(item.created_at))}</td><td>{item.user?.full_name ?? (item.user_id ? String(item.user_id) : "—")}</td><td className="font-bold text-ink">{item.action_type}</td><td>{item.target_table}</td><td>{item.target_id ?? "—"}</td><td className="tabular-nums">{item.ip_address ?? "—"}</td></tr>)}
          </tbody></DataTable>
          <p className="border-t border-line p-4 text-xs text-muted">إجمالي النتائج المطابقة: {new Intl.NumberFormat("ar").format(total)}</p>
        </DataState>
      </Panel>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted"><ClipboardList size={14} /> يُسجَّل هذا التعريف تلقائيًا من طبقة التكامل، ولا يمكن لأي واجهة تعديله.</div>
    </>
  );
}
