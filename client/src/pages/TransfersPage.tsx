import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Camp, Unit } from "../lib/types";
import { Button, DataState, DataTable, Field, inputClass, Modal, PageHeader, Panel, StatusBadge } from "../components/ui";

interface TransferRecord {
  transfer_id: number;
  personnel_id: number;
  camp_from_id: number;
  camp_to_id: number;
  status: string;
  reason: string | null;
  requested_at: string;
  personnel: { personnel_id: number; full_name: string };
  camp_from: { camp_id: number; name: string };
  camp_to: { camp_id: number; name: string };
}
interface EligiblePerson {
  personnel_id: number;
  full_name: string;
  camp_id: number | null;
  camp: { camp_id: number; name: string } | null;
}
const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [people, setPeople] = useState<EligiblePerson[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [personId, setPersonId] = useState("");
  const [destinationCampId, setDestinationCampId] = useState("");
  const [destinationUnitId, setDestinationUnitId] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [transferData, peopleData, campData, unitData] = await Promise.all([
        api.get<{ items: TransferRecord[] }>("/transfers"),
        api.get<{ items: EligiblePerson[] }>("/transfers/eligible-personnel"),
        api.get<{ items: Camp[] }>("/camps"),
        api.get<{ items: Unit[] }>("/units"),
      ]);
      setTransfers(transferData.items);
      setPeople(peopleData.items);
      setCamps(campData.items);
      setUnits(unitData.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل بيانات الانتقالات.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selectedPerson = people.find((person) => String(person.personnel_id) === personId);
  const destinationUnits = useMemo(() => units.filter((unit) => unit.camp_id === Number(destinationCampId)), [units, destinationCampId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    try {
      if (!selectedPerson?.camp_id) throw new Error("يجب أن يكون للفرد معسكر حالي قبل نقله.");
      await api.post("/transfers", {
        personnel_id: selectedPerson.personnel_id,
        camp_from_id: selectedPerson.camp_id,
        camp_to_id: Number(destinationCampId),
        unit_to_id: Number(destinationUnitId),
        reason: String(form.get("reason") ?? "").trim() || undefined,
      });
      setOpen(false);
      setNotice("اكتمل النقل بنجاح، وتم حفظ سجل النقل والتدقيق ضمن معاملة واحدة.");
      setPersonId("");
      setDestinationCampId("");
      setDestinationUnitId("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "تعذّر تنفيذ النقل.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="الانتقالات بين المعسكرات" subtitle="نقل فرد إلى وحدة في معسكر آخر. يتحقق الخادم من السعة وينفّذ تحديث الفرد وسجل النقل والتدقيق ذريًا." action={<Button onClick={() => { setFormError(null); setOpen(true); }}><Plus size={17} />نقل جديد</Button>} />
      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="إغلاق">×</button></div>}
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4"><span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><ArrowLeftRight size={19} /></span><div><h2 className="font-black">سجل الانتقالات</h2><p className="mt-1 text-xs text-muted">{new Intl.NumberFormat("ar").format(transfers.length)} عملية محفوظة دون حذف السجلات السابقة.</p></div></div>
        <DataState loading={loading} error={error} empty={!loading && !error && transfers.length === 0} onRetry={() => void load()}>
          <DataTable><thead><tr><th>الفرد</th><th>من المعسكر</th><th>إلى المعسكر</th><th>السبب</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>
            {transfers.map((item) => <tr key={item.transfer_id}><td className="font-bold text-ink">{item.personnel.full_name}</td><td>{item.camp_from.name}</td><td>{item.camp_to.name}</td><td>{item.reason || "—"}</td><td>{dateFmt.format(new Date(item.requested_at))}</td><td><StatusBadge value={item.status} /></td></tr>)}
          </tbody></DataTable>
        </DataState>
      </Panel>
      {open && <Modal title="تنفيذ نقل أكاديمي" description="سيتم تحديث المعسكر والوحدة الحالية وحفظ سجل النقل والتدقيق في معاملة واحدة. لا تُغيّر العملية سجل الحالة التاريخي." onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="الفرد"><select name="personnel_id" required className={inputClass()} value={personId} onChange={(event) => { setPersonId(event.target.value); setDestinationCampId(""); setDestinationUnitId(""); }}><option value="">اختر فردًا</option>{people.map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.full_name}{person.camp ? ` — ${person.camp.name}` : " — دون معسكر"}</option>)}</select></Field>
          <Field label="المعسكر الحالي"><input readOnly aria-label="المعسكر الحالي" value={selectedPerson?.camp?.name ?? "يُحدد من سجل الفرد"} className={`${inputClass()} bg-slate-50`} /></Field>
          <Field label="المعسكر المستقبِل"><select name="camp_to_id" required className={inputClass()} value={destinationCampId} onChange={(event) => { setDestinationCampId(event.target.value); setDestinationUnitId(""); }}><option value="">اختر معسكرًا</option>{camps.filter((camp) => camp.is_active && camp.camp_id !== selectedPerson?.camp_id).map((camp) => <option key={camp.camp_id} value={camp.camp_id}>{camp.name} — السعة {new Intl.NumberFormat("ar").format(camp.capacity)}</option>)}</select></Field>
          <Field label="الوحدة المستقبِلة"><select name="unit_to_id" required disabled={!destinationCampId} className={inputClass()} value={destinationUnitId} onChange={(event) => setDestinationUnitId(event.target.value)}><option value="">اختر وحدة تابعة للمعسكر</option>{destinationUnits.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select></Field>
          <Field label="سبب النقل (اختياري)"><textarea name="reason" rows={3} maxLength={1000} className={inputClass()} placeholder="بيانات أكاديمية افتراضية فقط" /></Field>
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">السعة النهائية تُتحقق داخل قاعدة البيانات لتجنب تجاوزها عند تزامن الطلبات. إذا تعذر أي جزء، تُلغى العملية كاملة.</p>
          {formError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={saving || !selectedPerson?.camp_id || !destinationCampId || !destinationUnitId}>{saving ? "جارٍ تنفيذ النقل…" : "تأكيد النقل"}</Button></div>
        </form>
      </Modal>}
    </>
  );
}
