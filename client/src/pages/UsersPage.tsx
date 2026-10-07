import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Shield, UserRound, Pencil, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { ManagedUser, PasswordPolicy, RoleOption } from "../lib/types";
import { Button, DataState, DataTable, Field, inputClass, Modal, PageHeader, Panel, StatusBadge } from "../components/ui";

function roleLabel(roleName: string) {
  const labels: Record<string, string> = {
    "System Administrator": "مدير النظام",
    "Personnel Officer": "مسؤول الأفراد",
    "Camp Manager": "مدير المعسكر",
    "Report Viewer": "مستعرض التقارير",
  };
  return labels[roleName] ?? roleName;
}

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>({ passwordMinLength: 8, requireUppercase: false, requireNumber: false, requireSymbol: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<ManagedUser | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userData, roleData, policy] = await Promise.all([
        api.get<{ items: ManagedUser[] }>("/users"),
        api.get<{ items: { role_id: number; role_name: string; description: string | null }[] }>("/users/roles"),
        api.get<PasswordPolicy>("/settings/password-policy"),
      ]);
      setUsers(userData.items);
      setRoles(roleData.items.map((item) => ({ role_id: item.role_id, role_name: item.role_name, description: item.description })));
      setPasswordPolicy(policy);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل المستخدمين.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const roleIds = form.getAll("role_ids").map(Number).filter(Number.isInteger);
    const fullName = String(form.get("full_name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const isActive = form.get("is_active") === "on";
    const password = String(form.get("password") ?? "");
    const payload = active === null
      ? {
          username: String(form.get("username") ?? "").trim(),
          full_name: fullName,
          email: email || undefined,
          password,
          role_ids: roleIds,
        }
      : {
          full_name: fullName,
          email: email || null,
          is_active: isActive,
          ...(password ? { password } : {}),
          role_ids: roleIds,
        };

    const riskyChange = Boolean(active && (
      active.is_active !== isActive ||
      JSON.stringify(active.roles.map((item) => item.role.role_id).sort()) !== JSON.stringify([...roleIds].sort())
    ));
    if (riskyChange && form.get("confirm_sensitive_change") !== "on") {
      setFormError("يرجى تأكيد تغيير حالة الحساب أو أدواره قبل الحفظ.");
      setSaving(false);
      return;
    }

    try {
      if (active && active !== null) await api.put(`/users/${active.user_id}`, payload);
      else await api.post("/users", payload);
      setActive(undefined);
      setNotice(active ? "تم تحديث حساب المستخدم وصلاحياته." : "تم إنشاء الحساب بنجاح.");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "تعذّر حفظ حساب المستخدم.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter((user) => `${user.full_name} ${user.username} ${user.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <PageHeader title="إدارة المستخدمين" subtitle="إدارة الحسابات والأدوار. تُحدّث الصلاحيات الفعلية على الخادم عند كل طلب." action={<Button onClick={() => { setFormError(null); setActive(null); }}><Plus size={17} />إضافة مستخدم</Button>} />
      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="إغلاق">×</button></div>}
      <div className="mb-5 grid gap-4 sm:grid-cols-2"><Panel className="flex items-center gap-4 p-4"><span className="rounded-xl bg-brand-50 p-3 text-brand-600"><UserRound size={20} /></span><div><p className="text-xs font-bold text-muted">إجمالي الحسابات</p><p className="mt-1 text-xl font-black">{new Intl.NumberFormat("ar").format(users.length)}</p></div></Panel><Panel className="flex items-center gap-4 p-4"><span className="rounded-xl bg-violet-50 p-3 text-violet-600"><Shield size={20} /></span><div><p className="text-xs font-bold text-muted">الأدوار المعرفة</p><p className="mt-1 text-xl font-black">{new Intl.NumberFormat("ar").format(roles.length)}</p></div></Panel></div>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="font-black">الحسابات المسجلة</h2><p className="mt-1 text-xs text-muted">لا تُعرض كلمات المرور أو تجزئاتها في الواجهة.</p></div><label className="relative block sm:w-72"><span className="sr-only">بحث في الحسابات</span><Search size={16} className="absolute right-3 top-3 text-muted" /><input className={`${inputClass()} pr-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم أو المستخدم…" /></label></div>
        <DataState loading={loading} error={error} empty={!loading && !error && filtered.length === 0} onRetry={() => void load()}>
          <DataTable><thead><tr><th>المستخدم</th><th>البريد الإلكتروني</th><th>الأدوار</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
            {filtered.map((user) => <tr key={user.user_id}><td><p className="font-bold text-ink">{user.full_name}</p><p className="mt-0.5 text-xs text-muted">@{user.username}</p></td><td>{user.email || "—"}</td><td><div className="flex flex-wrap gap-1.5">{user.roles.length ? user.roles.map(({ role }) => <span key={role.role_id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{roleLabel(role.role_name)}</span>) : <span className="text-xs text-muted">دون دور</span>}</div></td><td><StatusBadge value={user.is_active ? "active" : "inactive"} /></td><td><button onClick={() => { setFormError(null); setActive(user); }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50"><Pencil size={14} />تعديل</button></td></tr>)}
            {!filtered.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">لا توجد حسابات مطابقة لبحثك.</td></tr>}
          </tbody></DataTable>
        </DataState>
      </Panel>

      {active !== undefined && <Modal title={active ? "تعديل حساب مستخدم" : "إنشاء حساب جديد"} description="تُحفظ كلمات المرور مجزأة في الخادم ولا يمكن استعادتها كنص صريح." onClose={() => setActive(undefined)}>
        <form onSubmit={submit} className="space-y-4">
          {!active && <Field label="اسم المستخدم"><input name="username" required minLength={3} maxLength={100} className={inputClass()} autoComplete="off" /></Field>}
          <Field label="الاسم الكامل"><input name="full_name" required minLength={1} maxLength={200} className={inputClass()} defaultValue={active?.full_name ?? ""} /></Field>
          <Field label="البريد الإلكتروني"><input name="email" type="email" maxLength={200} className={inputClass()} defaultValue={active?.email ?? ""} /></Field>
          <Field label={active ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"} hint={`الحد الأدنى ${passwordPolicy.passwordMinLength} أحرف${passwordPolicy.requireUppercase ? " · حرف لاتيني كبير" : ""}${passwordPolicy.requireNumber ? " · رقم" : ""}${passwordPolicy.requireSymbol ? " · رمز خاص" : ""}`}><input name="password" type="password" required={!active} minLength={passwordPolicy.passwordMinLength} maxLength={200} autoComplete="new-password" className={inputClass()} /></Field>
          <Field label="الأدوار" hint="يمكن اختيار أكثر من دور باستخدام Ctrl أو Command."><select name="role_ids" multiple required={!active} className={`${inputClass()} min-h-32`} defaultValue={active?.roles.map(({ role }) => String(role.role_id)) ?? []}>{roles.map((role) => <option key={role.role_id} value={role.role_id}>{roleLabel(role.role_name)}</option>)}</select></Field>
          {active && <><label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-bold"><input type="checkbox" name="is_active" defaultChecked={active.is_active} className="h-4 w-4 accent-brand-600" />الحساب نشط</label><label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><input type="checkbox" name="confirm_sensitive_change" className="mt-1 h-4 w-4 accent-brand-600" />عند تغيير الدور أو حالة الحساب، أؤكد أن ذلك سيغيّر الصلاحيات الفعلية للمستخدم.</label></>}
          {formError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setActive(undefined)}>إلغاء</Button><Button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button></div>
        </form>
      </Modal>}
    </>
  );
}
