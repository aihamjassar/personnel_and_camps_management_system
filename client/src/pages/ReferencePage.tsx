import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, MapPinned, Medal, Plus, BriefcaseBusiness, Pencil, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Camp, Position, Rank, Unit } from "../lib/types";
import { Button, DataState, DataTable, EmptyTableRow, Field, inputClass, Modal, PageHeader, Panel } from "../components/ui";

type Kind = "camps" | "units" | "ranks" | "positions";
type Item = Camp | Unit | Rank | Position;

const config: Record<Kind, { title: string; subtitle: string; singular: string; icon: typeof Building2; columns: string[] }> = {
  camps: { title: "المعسكرات", subtitle: "إدارة المواقع والسعات التجريبية ضمن نطاق المشروع الأكاديمي.", singular: "معسكر", icon: MapPinned, columns: ["الاسم", "الموقع", "السعة"] },
  units: { title: "الوحدات التنظيمية", subtitle: "تنظيم الوحدات وربطها بالمعسكرات والسجلات الإدارية.", singular: "وحدة", icon: Building2, columns: ["اسم الوحدة", "المعسكر", "الوحدة الأب"] },
  ranks: { title: "الرتب", subtitle: "ترتيب الرتب المرجعية لاستخدامها في ملفات الأفراد.", singular: "رتبة", icon: Medal, columns: ["اسم الرتبة", "مستوى الترتيب", "الوصف"] },
  positions: { title: "المناصب", subtitle: "إدارة المناصب المرجعية المستخدمة عند تسجيل التعيينات.", singular: "منصب", icon: BriefcaseBusiness, columns: ["اسم المنصب", "الوحدة", "الوصف"] },
};

function itemId(kind: Kind, item: Item) {
  if (kind === "camps") return (item as Camp).camp_id;
  if (kind === "units") return (item as Unit).unit_id;
  if (kind === "ranks") return (item as Rank).rank_id;
  return (item as Position).position_id;
}

function itemName(item: Item) {
  return item.name;
}

export default function ReferencePage({ kind }: { kind: Kind }) {
  const meta = config[kind];
  const Icon = meta.icon;
  const [items, setItems] = useState<Item[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Item | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ items: Item[] }>(`/${kind}`);
      setItems(result.items);
      if (kind === "units") {
        const resultCamps = await api.get<{ items: Camp[] }>("/camps");
        setCamps(resultCamps.items);
      }
      if (kind === "positions") {
        const resultUnits = await api.get<{ items: Unit[] }>("/units");
        setUnits(resultUnits.items);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل السجلات.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setQuery("");
    setNotice(null);
    setFormError(null);
    setActive(undefined);
  }, [kind]);

  const filtered = useMemo(() => items.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, query]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    let payload: Record<string, unknown> = { name };
    if (kind === "camps") {
      payload = { name, capacity: Number(form.get("capacity") || 0), location: String(form.get("location") ?? "").trim() || undefined };
    } else if (kind === "units") {
      payload = { name, camp_id: Number(form.get("camp_id")), parent_unit_id: form.get("parent_unit_id") ? Number(form.get("parent_unit_id")) : undefined };
    } else if (kind === "ranks") {
      payload = { name, level: Number(form.get("level")), description: String(form.get("description") ?? "").trim() || undefined };
    } else {
      payload = { name, unit_id: form.get("unit_id") ? Number(form.get("unit_id")) : undefined, description: String(form.get("description") ?? "").trim() || undefined };
    }
    try {
      if (active && active !== null) await api.put(`/${kind}/${itemId(kind, active)}`, payload);
      else await api.post(`/${kind}`, payload);
      setActive(undefined);
      setNotice(`تم حفظ ${meta.singular} بنجاح.`);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر حفظ السجل.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title={meta.title} subtitle={meta.subtitle} action={<Button onClick={() => { setFormError(null); setActive(null); }}><Plus size={17} />إضافة {meta.singular}</Button>} />
      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="إغلاق">×</button></div>}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Icon size={19} /></span><div><h2 className="font-black">قائمة {meta.title}</h2><p className="mt-1 text-xs text-muted">{new Intl.NumberFormat("ar").format(items.length)} سجل</p></div></div>
          <label className="relative block sm:w-72"><span className="sr-only">بحث في السجلات</span><Search size={16} className="absolute right-3 top-3 text-muted" /><input className={`${inputClass()} pr-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث…" /></label>
        </div>
        <DataState loading={loading} error={error} empty={!loading && !error && filtered.length === 0} onRetry={() => void load()}>
          <DataTable><thead><tr><th>م</th>{meta.columns.map((column) => <th key={column}>{column}</th>)}<th>إجراء</th></tr></thead><tbody>
            {filtered.length === 0 ? <EmptyTableRow columns={meta.columns.length + 2} /> : filtered.map((item, index) => <tr key={itemId(kind, item)}><td className="tabular-nums text-muted">{new Intl.NumberFormat("ar").format(index + 1)}</td><td className="font-bold text-ink">{itemName(item)}</td>
              {kind === "camps" && <><td>{(item as Camp).location || "—"}</td><td>{new Intl.NumberFormat("ar").format((item as Camp).capacity)}</td></>}
              {kind === "units" && <><td>{(item as Unit).camp?.name ?? camps.find((camp) => camp.camp_id === (item as Unit).camp_id)?.name ?? "—"}</td><td>{units.find((unit) => unit.unit_id === (item as Unit).parent_unit_id)?.name ?? "—"}</td></>}
              {kind === "ranks" && <><td>{new Intl.NumberFormat("ar").format((item as Rank).level)}</td><td>{(item as Rank).description || "—"}</td></>}
              {kind === "positions" && <><td>{units.find((unit) => unit.unit_id === (item as Position).unit_id)?.name ?? "—"}</td><td>{(item as Position).description || "—"}</td></>}
              <td><button onClick={() => { setFormError(null); setActive(item); }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50"><Pencil size={14} />تعديل</button></td></tr>)}
          </tbody></DataTable>
        </DataState>
      </Panel>
      {active !== undefined && <Modal title={`${active ? "تعديل" : "إضافة"} ${meta.singular}`} onClose={() => setActive(undefined)}>
        <form onSubmit={save} className="space-y-4">
          <Field label="الاسم"><input name="name" required minLength={1} maxLength={200} defaultValue={active ? itemName(active) : ""} className={inputClass()} /></Field>
          {kind === "camps" && <><Field label="الموقع التجريبي"><input name="location" maxLength={300} defaultValue={active ? (active as Camp).location ?? "" : ""} className={inputClass()} placeholder="مثال: المنطقة الشمالية" /></Field><Field label="السعة"><input name="capacity" type="number" min={0} required defaultValue={active ? (active as Camp).capacity : 0} className={inputClass()} /></Field></>}
          {kind === "units" && <><Field label="المعسكر"><select name="camp_id" required className={inputClass()} defaultValue={active ? String((active as Unit).camp_id) : ""}><option value="" disabled>اختر معسكرًا</option>{camps.map((camp) => <option key={camp.camp_id} value={camp.camp_id}>{camp.name}</option>)}</select></Field><Field label="الوحدة الأب (اختياري)"><select name="parent_unit_id" className={inputClass()} defaultValue={active && (active as Unit).parent_unit_id ? String((active as Unit).parent_unit_id) : ""}><option value="">من دون وحدة أب</option>{units.filter((unit) => !active || unit.unit_id !== (active as Unit).unit_id).map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select></Field></>}
          {kind === "ranks" && <><Field label="مستوى الترتيب"><input name="level" type="number" min={1} required defaultValue={active ? (active as Rank).level : 1} className={inputClass()} /></Field><Field label="الوصف"><textarea name="description" rows={2} maxLength={500} defaultValue={active ? (active as Rank).description ?? "" : ""} className={inputClass()} /></Field></>}
          {kind === "positions" && <><Field label="الوحدة (اختياري)"><select name="unit_id" className={inputClass()} defaultValue={active && (active as Position).unit_id ? String((active as Position).unit_id) : ""}><option value="">غير محددة</option>{units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select></Field><Field label="الوصف"><textarea name="description" rows={2} maxLength={500} defaultValue={active ? (active as Position).description ?? "" : ""} className={inputClass()} /></Field></>}
          {formError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setActive(undefined)}>إلغاء</Button><Button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button></div>
        </form>
      </Modal>}
    </>
  );
}
