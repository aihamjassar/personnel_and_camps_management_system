import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, Plus, Pencil, History, UserRoundX, RotateCcw, UsersRound } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Camp, Personnel, PersonnelStatus, Rank, Unit } from "../lib/types";
import { Button, DataState, DataTable, Field, inputClass, Modal, PageHeader, Panel, StatusBadge } from "../components/ui";

const pageSize = 20;
const numberFmt = new Intl.NumberFormat("ar");
const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
const statusLabels: Record<string, string> = { active: "نشط", inactive: "غير نشط", on_leave: "في إجازة", transferred: "منقول", discharged: "منتهي الخدمة" };

type FormMode = "create" | "edit";

export default function PersonnelPage() {
  const [items, setItems] = useState<Personnel[]>([]);
  const [total, setTotal] = useState(0);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [search, setSearch] = useState("");
  const [campFilter, setCampFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ mode: FormMode; person?: Personnel } | null>(null);
  const [statusPerson, setStatusPerson] = useState<Personnel | null>(null);
  const [historyPerson, setHistoryPerson] = useState<Personnel | null>(null);
  const [history, setHistory] = useState<PersonnelStatus[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deactivatePerson, setDeactivatePerson] = useState<Personnel | null>(null);
  const [selectedCampId, setSelectedCampId] = useState("");

  const loadReferences = useCallback(async () => {
    try {
      const [campData, unitData, rankData] = await Promise.all([
        api.get<{ items: Camp[] }>("/camps"),
        api.get<{ items: Unit[] }>("/units"),
        api.get<{ items: Rank[] }>("/ranks"),
      ]);
      setCamps(campData.items);
      setUnits(unitData.items);
      setRanks(rankData.items);
    } catch {
      // The primary table still renders; form submission receives server validation errors if lookups are unavailable.
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) params.set("search", search);
    if (campFilter) params.set("camp_id", campFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (unitFilter) params.set("unit_id", unitFilter);
    if (rankFilter) params.set("rank_id", rankFilter);
    try {
      const result = await api.get<{ items: Personnel[]; total: number }>(`/personnel?${params.toString()}`);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل سجلات الأفراد.");
    } finally {
      setLoading(false);
    }
  }, [page, search, campFilter, statusFilter, unitFilter, rankFilter]);

  useEffect(() => { void loadReferences(); }, [loadReferences]);
  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const filteredUnits = useMemo(() => selectedCampId ? units.filter((unit) => unit.camp_id === Number(selectedCampId)) : units, [units, selectedCampId]);

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(queryInput.trim());
  }

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form?.mode === "edit" && !form.person) return;
    setSaving(true);
    setFormError(null);
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    const nullableText = (key: string) => text(key) || null;
    const optionalId = (key: string) => text(key) ? Number(text(key)) : null;
    const payload = {
      full_name: text("full_name"),
      national_id: form?.mode === "edit" ? nullableText("national_id") : text("national_id") || undefined,
      date_of_birth: form?.mode === "edit" ? (text("date_of_birth") || null) : text("date_of_birth") || undefined,
      gender: form?.mode === "edit" ? nullableText("gender") : text("gender") || undefined,
      phone: form?.mode === "edit" ? nullableText("phone") : text("phone") || undefined,
      email: form?.mode === "edit" ? nullableText("email") : text("email") || undefined,
      camp_id: form?.mode === "edit" ? optionalId("camp_id") : (text("camp_id") ? Number(text("camp_id")) : undefined),
      unit_id: form?.mode === "edit" ? optionalId("unit_id") : (text("unit_id") ? Number(text("unit_id")) : undefined),
      rank_id: form?.mode === "edit" ? optionalId("rank_id") : (text("rank_id") ? Number(text("rank_id")) : undefined),
    };
    try {
      if (form?.mode === "edit" && form.person) {
        await api.put(`/personnel/${form.person.personnel_id}`, payload);
        setNotice("تم تحديث بيانات الفرد.");
      } else {
        await api.post("/personnel", payload);
        setNotice("تمت إضافة الفرد وبدء سجل حالته.");
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر حفظ بيانات الفرد.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statusPerson) return;
    const formData = new FormData(event.currentTarget);
    const nextStatus = String(formData.get("status"));
    setSaving(true);
    setFormError(null);
    try {
      await api.post(`/personnel/${statusPerson.personnel_id}/status`, { status: nextStatus, notes: String(formData.get("notes") ?? "").trim() || undefined });
      setStatusPerson(null);
      setNotice("تم تحديث الحالة وإضافة سجل تاريخي جديد.");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر تغيير الحالة.");
    } finally {
      setSaving(false);
    }
  }

  async function showHistory(person: Personnel) {
    setHistoryPerson(person);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const result = await api.get<{ items: PersonnelStatus[] }>(`/personnel/${person.personnel_id}/status`);
      setHistory(result.items);
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : "تعذّر تحميل سجل الحالة.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function deactivate() {
    if (!deactivatePerson) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.delete(`/personnel/${deactivatePerson.personnel_id}`);
      setDeactivatePerson(null);
      setNotice("تم تعطيل السجل منطقيًا؛ لم يُحذف من قاعدة البيانات.");
      if (items.length === 1 && page > 1) setPage((current) => current - 1);
      else await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر تعطيل السجل.");
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setFormError(null);
    setSelectedCampId("");
    setForm({ mode: "create" });
  }

  return (
    <>
      <PageHeader title="إدارة الأفراد" subtitle="بحث وفلترة السجلات الإدارية، مع حفظ تاريخ الحالات والتعطيل المنطقي." action={<Button onClick={startCreate}><Plus size={17} />إضافة فرد</Button>} />
      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="إغلاق">×</button></div>}
      <Panel className="mb-5 p-4">
        <form onSubmit={runSearch} className="grid gap-3 md:grid-cols-[1fr_190px_170px_auto]">
          <label className="relative"><span className="sr-only">البحث بالاسم</span><Search size={16} className="absolute right-3 top-3 text-muted" /><input className={`${inputClass()} pr-9`} value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="بحث بالاسم الكامل…" /></label>
          <label className="sr-only" htmlFor="camp-filter">تصفية حسب المعسكر</label><select id="camp-filter" className={inputClass()} value={campFilter} onChange={(event) => { setCampFilter(event.target.value); setPage(1); }}><option value="">كل المعسكرات</option>{camps.map((camp) => <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>)}</select>
          <label className="sr-only" htmlFor="status-filter">تصفية حسب الحالة</label><select id="status-filter" className={inputClass()} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <label className="sr-only" htmlFor="unit-filter">تصفية حسب الوحدة</label><select id="unit-filter" className={inputClass()} value={unitFilter} onChange={(event) => { setUnitFilter(event.target.value); setPage(1); }}><option value="">كل الوحدات</option>{units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select>
          <label className="sr-only" htmlFor="rank-filter">تصفية حسب الرتبة</label><select id="rank-filter" className={inputClass()} value={rankFilter} onChange={(event) => { setRankFilter(event.target.value); setPage(1); }}><option value="">كل الرتب</option>{ranks.map((rank) => <option key={rank.rank_id} value={rank.rank_id}>{rank.name}</option>)}</select>
          <Button type="submit" variant="secondary"><Search size={16} />بحث</Button>
        </form>
      </Panel>
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><UsersRound size={19} /></span><div><h2 className="font-black">سجل الأفراد</h2><p className="mt-1 text-xs text-muted">{numberFmt.format(total)} سجل</p></div></div><span className="hidden rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-muted sm:inline">البيانات الفعلية من الخادم</span></div>
        <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} onRetry={() => void load()}>
          <DataTable><thead><tr><th>الفرد</th><th>الرقم التعريفي</th><th>المعسكر / الوحدة</th><th>الرتبة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
            {items.map((person) => <tr key={person.personnel_id}>
              <td><p className="font-bold text-ink">{person.full_name}</p><p className="mt-0.5 text-xs text-muted">{person.phone || "لا يوجد هاتف مسجل"}</p></td>
              <td className="tabular-nums">{person.national_id || "—"}</td>
              <td><p className="font-semibold">{person.camp?.name || "غير محدد"}</p><p className="mt-0.5 text-xs text-muted">{person.unit?.name || "دون وحدة"}</p></td>
              <td>{person.rank?.name || "—"}</td><td><StatusBadge value={person.current_status} /></td>
              <td><div className="flex flex-wrap items-center gap-1"><button title="تعديل" aria-label={`تعديل ${person.full_name}`} onClick={() => { setFormError(null); setSelectedCampId(person.camp_id ? String(person.camp_id) : ""); setForm({ mode: "edit", person }); }} className="grid h-8 w-8 place-items-center rounded-lg text-brand-700 hover:bg-brand-50"><Pencil size={15} /></button><button title="تغيير الحالة" aria-label={`تغيير حالة ${person.full_name}`} onClick={() => { setFormError(null); setStatusPerson(person); }} className="grid h-8 w-8 place-items-center rounded-lg text-teal-700 hover:bg-teal-50"><RotateCcw size={15} /></button><button title="سجل الحالة" aria-label={`سجل حالة ${person.full_name}`} onClick={() => void showHistory(person)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><History size={15} /></button><button title="تعطيل منطقي" aria-label={`تعطيل ${person.full_name}`} onClick={() => { setFormError(null); setDeactivatePerson(person); }} className="grid h-8 w-8 place-items-center rounded-lg text-rose-700 hover:bg-rose-50"><UserRoundX size={15} /></button></div></td>
            </tr>)}
          </tbody></DataTable>
          <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted">عرض {numberFmt.format(rangeStart)}–{numberFmt.format(rangeEnd)} من {numberFmt.format(total)}</p><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>السابق</Button><span className="min-w-20 text-center text-xs font-bold text-muted">صفحة {numberFmt.format(page)} من {numberFmt.format(totalPages)}</span><Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}>التالي</Button></div></div>
        </DataState>
      </Panel>

      {form && <Modal title={form.mode === "create" ? "إضافة فرد جديد" : "تعديل بيانات الفرد"} description="الحقول الاختيارية يمكن تركها فارغة. لا تُستخدم بيانات حقيقية." onClose={() => setForm(null)} wide>
        <form onSubmit={savePerson} className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل"><input name="full_name" required minLength={1} maxLength={200} defaultValue={form.person?.full_name ?? ""} className={inputClass()} /></Field>
          <Field label="الرقم التعريفي الافتراضي"><input name="national_id" maxLength={50} defaultValue={form.person?.national_id ?? ""} className={inputClass()} /></Field>
          <Field label="تاريخ الميلاد"><input name="date_of_birth" type="date" defaultValue={form.person?.date_of_birth?.slice(0, 10) ?? ""} className={inputClass()} /></Field>
          <Field label="الجنس"><select name="gender" defaultValue={form.person?.gender ?? ""} className={inputClass()}><option value="">غير محدد</option><option value="male">ذكر</option><option value="female">أنثى</option></select></Field>
          <Field label="رقم هاتف تجريبي"><input name="phone" maxLength={30} defaultValue={form.person?.phone ?? ""} className={inputClass()} /></Field>
          <Field label="البريد الإلكتروني"><input name="email" type="email" maxLength={200} defaultValue={form.person?.email ?? ""} className={inputClass()} /></Field>
          <Field label="المعسكر"><select name="camp_id" value={selectedCampId} onChange={(event) => setSelectedCampId(event.target.value)} className={inputClass()}><option value="">غير محدد</option>{camps.map((camp) => <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>)}</select></Field>
          <Field label="الوحدة التنظيمية"><select name="unit_id" defaultValue={form.person?.unit_id ? String(form.person.unit_id) : ""} className={inputClass()}><option value="">غير محددة</option>{filteredUnits.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select></Field>
          <Field label="الرتبة"><select name="rank_id" defaultValue={form.person?.rank_id ? String(form.person.rank_id) : ""} className={inputClass()}><option value="">غير محددة</option>{ranks.map((rank) => <option key={rank.rank_id} value={rank.rank_id}>{rank.name}</option>)}</select></Field>
          {formError && <p role="alert" className="sm:col-span-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button variant="secondary" onClick={() => setForm(null)}>إلغاء</Button><Button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ البيانات"}</Button></div>
        </form>
      </Modal>}

      {statusPerson && <Modal title={`تحديث حالة ${statusPerson.full_name}`} description="سيُحفظ كل تغيير كحدث جديد؛ لن يُستبدل السجل السابق." onClose={() => setStatusPerson(null)}>
        <form onSubmit={changeStatus} className="space-y-4"><Field label="الحالة الجديدة"><select name="status" required className={inputClass()} defaultValue={statusPerson.current_status}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="ملاحظات (اختياري)"><textarea name="notes" rows={3} maxLength={1000} className={inputClass()} /></Field><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" required className="h-4 w-4 accent-brand-600" />أؤكد حفظ الانتقال كسجل حالة جديد</label>{formError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setStatusPerson(null)}>إلغاء</Button><Button type="submit" disabled={saving}>حفظ الحالة</Button></div></form>
      </Modal>}

      {historyPerson && <Modal title={`السجل التاريخي · ${historyPerson.full_name}`} description="سجل تراكمي للانتقالات بين الحالات." onClose={() => setHistoryPerson(null)}>
        {historyLoading ? <div role="status" className="py-10 text-center text-sm text-muted">جارٍ تحميل السجل…</div> : historyError ? <div role="alert" className="py-6 text-sm text-rose-700">{historyError}<button onClick={() => void showHistory(historyPerson)} className="mr-3 font-bold underline">إعادة المحاولة</button></div> : history.length === 0 ? <p className="py-8 text-center text-sm text-muted">لا يوجد سجل حالة.</p> : <div className="max-h-[55vh] space-y-3 overflow-y-auto">{history.map((entry) => <div key={entry.status_id} className="rounded-2xl border border-line p-4"><div className="flex items-center justify-between gap-3"><StatusBadge value={entry.status} /><time className="text-xs text-muted">{dateFmt.format(new Date(entry.created_at))}</time></div>{entry.notes && <p className="mt-3 text-sm leading-6 text-slate-600">{entry.notes}</p>}</div>)}</div>}
      </Modal>}

      {deactivatePerson && <Modal title="تأكيد التعطيل المنطقي" description="لن يُحذف السجل فعليًا؛ سيختفي من القائمة العادية مع بقاء بياناته التاريخية." onClose={() => setDeactivatePerson(null)}>
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">هل تريد تعطيل سجل «{deactivatePerson.full_name}»؟ لا يمكن استخدام هذا الإجراء كحذف دائم.</p>{formError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeactivatePerson(null)}>إلغاء</Button><Button variant="danger" disabled={saving} onClick={() => void deactivate()}>{saving ? "جارٍ التعطيل…" : "تعطيل السجل"}</Button></div>
      </Modal>}
    </>
  );
}
