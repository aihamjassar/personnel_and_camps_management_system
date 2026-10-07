import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Save, Settings as SettingsIcon, ShieldCheck, Timer } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { SystemSettings } from "../lib/types";
import { Button, DataState, Field, inputClass, PageHeader, Panel } from "../components/ui";

const defaults: SystemSettings = {
  passwordMinLength: 8,
  requireUppercase: false,
  requireNumber: false,
  requireSymbol: false,
  sessionDurationHours: 8,
};

const passwordOptions = [
  { key: "requireUppercase" as const, label: "يشترط حرفًا كبيرًا (مثل A–Z)" },
  { key: "requireNumber" as const, label: "يشترط رقمًا واحدًا على الأقل" },
  { key: "requireSymbol" as const, label: "يشترط رمزًا خاصًا واحدًا على الأقل" },
];

export default function SettingsPage() {
  const [saved, setSaved] = useState<SystemSettings>(defaults);
  const [draft, setDraft] = useState<SystemSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ settings: SystemSettings }>("/settings");
      setSaved(result.settings);
      setDraft(result.settings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل إعدادات النظام.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const result = await api.put<{ settings: SystemSettings }>("/settings", draft);
      setSaved(result.settings);
      setDraft(result.settings);
      setNotice("تم حفظ الإعدادات وتسجيل التغيير في سجل التدقيق.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر حفظ إعدادات النظام.");
    } finally {
      setSaving(false);
    }
  }

  const changed = JSON.stringify(saved) !== JSON.stringify(draft);

  return (
    <>
      <PageHeader
        title="إعدادات النظام"
        subtitle="تحديد الحد الأدنى لسياسة كلمات المرور والمدة القصوى للجلسات الجديدة. التغييرات متاحة لمدير النظام فقط."
      />
      {notice && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">{notice}</div>}
      <DataState loading={loading} error={error} empty={false} onRetry={() => void load()}>
        <form onSubmit={submit} className="space-y-5">
          <Panel className="overflow-hidden">
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><ShieldCheck size={19} /></span>
              <div><h2 className="font-black">سياسة كلمات المرور</h2><p className="mt-1 text-sm leading-6 text-muted">تُطبّق على الحسابات الجديدة وكلمات المرور التي يعاد تعيينها، ولا تغيّر كلمات المرور الحالية.</p></div>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <Field label="الحد الأدنى لطول كلمة المرور" hint="من 8 إلى 64 حرفًا. تُطبّق القاعدة نفسها في واجهة إنشاء المستخدم والخادم.">
                <input type="number" min={8} max={64} required value={draft.passwordMinLength} onChange={(event) => update("passwordMinLength", Number(event.target.value))} className={inputClass()} />
              </Field>
              <div className="space-y-3" role="group" aria-label="قواعد إضافية لكلمة المرور">
                <p className="text-sm font-bold text-ink">قواعد إضافية</p>
                {passwordOptions.map(({ key, label }) => (
                  <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink">
                    <input type="checkbox" checked={draft[key]} onChange={(event) => update(key, event.target.checked)} className="h-4 w-4 accent-brand-600" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Timer size={19} /></span>
              <div><h2 className="font-black">مدة الجلسة</h2><p className="mt-1 text-sm leading-6 text-muted">الحد الأقصى لصلاحية رمز الدخول، ويطبّق على عمليات تسجيل الدخول التالية فقط.</p></div>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <Field label="مدة الجلسة بالساعات" hint="من ساعة إلى 24 ساعة. الرموز الصادرة سابقًا لا تتأثر بالتغيير.">
                <input type="number" min={1} max={24} required value={draft.sessionDurationHours} onChange={(event) => update("sessionDurationHours", Number(event.target.value))} className={inputClass()} />
              </Field>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                <SettingsIcon size={18} className="shrink-0 text-brand-700" />
                كل تعديل يُحفظ مع سجل تدقيق يتضمن الإعدادات السابقة والجديدة وهوية مدير النظام.
              </div>
            </div>
          </Panel>

          {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={!changed || saving}><Save size={17} />{saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</Button></div>
        </form>
      </DataState>
    </>
  );
}
