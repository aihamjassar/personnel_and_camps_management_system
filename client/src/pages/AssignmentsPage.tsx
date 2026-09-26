import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, ClipboardList, CalendarDays } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Assignment, Personnel, Position, Unit } from "../lib/types";
import { Button, DataState, DataTable, Field, inputClass, Modal, PageHeader, Panel, StatusBadge } from "../components/ui";

const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });

export default function AssignmentsPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [people, setPeople] = useState<Personnel[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentData, personnelData, unitData, positionData] = await Promise.all([
        api.get<{ items: Assignment[]; total: number }>("/assignments"),
        api.get<{ items: Personnel[] }>("/personnel?page=1&page_size=100"),
        api.get<{ items: Unit[] }>("/units"),
        api.get<{ items: Position[] }>("/positions"),
      ]);
      setItems(assignmentData.items);
      setPeople(personnelData.items);
      setUnits(unitData.items);
      setPositions(positionData.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل بيانات التعيينات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await api.post<Assignment>("/assignments", {
        personnel_id: Number(form.get("personnel_id")),
        unit_id: Number(form.get("unit_id")),
        position_id: Number(form.get("position_id")),
        start_date: form.get("start_date") || undefined,
        notes: String(form.get("notes") ?? "").trim() || undefined,
      });
      setOpen(false);
      setNotice("تم حفظ التعيين. أُغلق التعيين السابق للفرد تلقائيًا عند وجوده.");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر حفظ التعيين.");
    } finally {
      setSaving(false);
    }
  }

  const currentCount = items.filter((item) => !item.end_date).length;

  return (
    <>
      <PageHeader title="التعيينات" subtitle="تسجيل التعيينات الوظيفية وحفظ التسلسل التاريخي لكل فرد." action={<Button onClick={() => { setFormError(null); setOpen(true); }}><Plus size={17} />تعيين جديد</Button>} />
      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="إغلاق">×</button></div>}
      <div className="mb-5 grid gap-4 sm:grid-cols-2"><Panel className="flex items-center gap-4 p-4"><span className="rounded-xl bg-brand-50 p-3 text-brand-600"><ClipboardList size={20} /></span><div><p className="text-xs font-bold text-muted">إجمالي سجلات التعيين</p><p className="mt-1 text-xl font-black">{new Intl.NumberFormat("ar").format(items.length)}</p></div></Panel><Panel className="flex items-center gap-4 p-4"><span className="rounded-xl bg-teal-50 p-3 text-teal-600"><CalendarDays size={20} /></span><div><p className="text-xs font-bold text-muted">التعيينات الحالية</p><p className="mt-1 text-xl font-black">{new Intl.NumberFormat("ar").format(currentCount)}</p></div></Panel></div>
      <Panel className="overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h2 className="font-black">سجل التعيينات</h2><p className="mt-1 text-xs text-muted">عند إضافة تعيين جديد، يحفظ النظام السابق كسجل منتهٍ.</p></div>
        <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} onRetry={() => void load()}>
          <DataTable><thead><tr><th>الفرد</th><th>الوحدة</th><th>المنصب</th><th>تاريخ البداية</th><th>تاريخ النهاية</th><th>الحالة</th></tr></thead><tbody>
            {items.map((item) => <tr key={item.assignment_id}><td className="font-bold text-ink">{item.personnel?.full_name ?? `#${item.personnel_id}`}</td><td>{item.unit?.name ?? "—"}</td><td>{item.position?.name ?? "—"}</td><td>{dateFmt.format(new Date(item.start_date))}</td><td>{item.end_date ? dateFmt.format(new Date(item.end_date)) : "—"}</td><td><StatusBadge value={item.end_date ? "inactive" : "active"} /></td></tr>)}
          </tbody></DataTable>
        </DataState>
      </Panel>
      {open && <Modal title="إضافة تعيين" description="سيتم الاحتفاظ بكل التعيينات السابقة في السجل." onClose={() => setOpen(false)}>
        <form onSubmit={createAssignment} className="space-y-4">
          <Field label="الفرد"><select name="personnel_id" required className={inputClass()} defaultValue=""><option value="" disabled>اختر فردًا</option>{people.map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.full_name}</option>)}</select></Field>
          <Field label="الوحدة التنظيمية"><select name="unit_id" required className={inputClass()} defaultValue=""><option value="" disabled>اختر وحدة</option>{units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select></Field>
          <Field label="المنصب"><select name="position_id" required className={inputClass()} defaultValue=""><option value="" disabled>اختر منصبًا</option>{positions.map((position) => <option key={position.position_id} value={position.position_id}>{position.name}</option>)}</select></Field>
          <Field label="تاريخ البداية"><input name="start_date" type="date" className={inputClass()} /></Field>
          <Field label="ملاحظات"><textarea name="notes" rows={3} maxLength={1000} className={inputClass()} /></Field>
          {formError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ التعيين"}</Button></div>
        </form>
      </Modal>}
    </>
  );
}
