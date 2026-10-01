import { useCallback, useEffect, useState } from "react";
import { Check, Save, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Button, DataState, PageHeader, Panel } from "../components/ui";

interface Permission { permission_id: number; permission_key: string; description: string | null; }
interface Role { role_id: number; role_name: string; description: string | null; permissions: { permission: Permission }[]; _count: { users: number }; }
const permissionLabels: Record<string, string> = {
  "personnel.manage": "إدارة سجلات الأفراد",
  "camps.manage": "إدارة المعسكرات",
  "units.manage": "إدارة الوحدات التنظيمية",
  "ranks.manage": "إدارة الرتب",
  "positions.manage": "إدارة المناصب",
  "assignments.manage": "إدارة التعيينات",
  "transfers.manage": "إدارة الانتقالات بين المعسكرات",
  "users.manage": "إدارة حسابات المستخدمين والأدوار",
  "reports.view": "عرض لوحة التحكم والتقارير",
  "audit.view": "عرض سجل التدقيق",
  "system.admin": "إدارة النظام الكاملة",
};
const roleLabels: Record<string, string> = {
  "System Administrator": "مدير النظام",
  "Personnel Officer": "مسؤول شؤون الأفراد",
  "Camp Manager": "مدير المعسكر",
  "Report Viewer": "مستعرض التقارير",
};
export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = roles.find((role) => role.role_id === selectedId) ?? null;
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleData, permissionData] = await Promise.all([
        api.get<{ items: Role[] }>("/roles"),
        api.get<{ items: Permission[] }>("/roles/permissions"),
      ]);
      setRoles(roleData.items);
      setPermissions(permissionData.items);
      const first = roleData.items[0];
      setSelectedId((prior) => prior && roleData.items.some((role) => role.role_id === prior) ? prior : first?.role_id ?? null);
      if (first && selectedId === null) {
        const ids = first.permissions.map(({ permission }) => permission.permission_id);
        setDraft(ids); setSaved(ids);
      }
      const currentId = selectedId ?? first?.role_id;
      const currentRole = roleData.items.find((role) => role.role_id === currentId);
      if (currentRole) {
        const ids = currentRole.permissions.map(({ permission }) => permission.permission_id);
        setDraft(ids); setSaved(ids);
      }
      setConfirm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل الأدوار والصلاحيات.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);
  useEffect(() => { void load(); }, [load]);
  function selectRole(role: Role) {
    const ids = role.permissions.map(({ permission }) => permission.permission_id);
    setSelectedId(role.role_id); setDraft(ids); setSaved(ids); setConfirm(false); setNotice(null);
  }
  function togglePermission(permissionId: number) {
    setDraft((current) => current.includes(permissionId) ? current.filter((id) => id !== permissionId) : [...current, permissionId]);
    setConfirm(false);
  }
  async function save() {
    if (!selected || !confirm || saving) return;
    setSaving(true); setNotice(null); setError(null);
    try {
      await api.put(`/roles/${selected.role_id}/permissions`, { permission_ids: draft });
      setNotice("تم تحديث الصلاحيات. تُطبق الصلاحيات الجديدة فورًا على طلبات API التالية.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حفظ الصلاحيات.");
    } finally {
      setSaving(false);
    }
  }
  const changed = draft.length !== saved.length || draft.some((id) => !saved.includes(id));
  return (
    <>
      <PageHeader title="الأدوار والصلاحيات" subtitle="تعيين صلاحيات API للأدوار. يجلب الخادم الصلاحيات من قاعدة البيانات في كل طلب، لذلك تسري التغييرات فورًا دون إعادة تسجيل الدخول." />
      {notice && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">{notice}</div>}
      {error && !loading && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" role="alert">{error}</div>}
      <DataState loading={loading} error={null} empty={!loading && roles.length === 0} onRetry={() => void load()}>
        <div className="grid gap-5 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.6fr)]">
          <Panel className="overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="font-black">الأدوار المعرفة</h2><p className="mt-1 text-xs text-muted">اختر دورًا لمراجعة صلاحياته.</p></div><div className="divide-y divide-line">
            {roles.map((role) => <button key={role.role_id} type="button" onClick={() => selectRole(role)} className={`w-full px-5 py-4 text-right transition ${selectedId === role.role_id ? "bg-brand-50" : "hover:bg-slate-50"}`}><span className="flex items-center justify-between gap-2"><span className="font-bold text-ink">{roleLabels[role.role_name] ?? role.role_name}</span>{selectedId === role.role_id && <Check size={16} className="text-brand-600" />}</span><span className="mt-1 block text-xs text-muted">{role._count.users} مستخدم مرتبط</span></button>)}
          </div></Panel>
          <Panel className="overflow-hidden"><div className="flex items-start gap-3 border-b border-line px-5 py-4"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><ShieldCheck size={19} /></span><div><h2 className="font-black">صلاحيات {selected ? (roleLabels[selected.role_name] ?? selected.role_name) : "الدور"}</h2><p className="mt-1 text-xs leading-5 text-muted">{selected?.description || "حدّد أقل مجموعة لازمة لإنجاز مهام الدور."}</p></div></div>
            <div className="grid gap-2 p-4 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.permission_id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-slate-50"><input type="checkbox" checked={draft.includes(permission.permission_id)} onChange={() => togglePermission(permission.permission_id)} className="mt-1 h-4 w-4 accent-brand-600" /><span><span className="block text-sm font-bold text-ink">{permissionLabels[permission.permission_key] ?? permission.permission_key}</span><span className="mt-1 block text-xs text-muted" dir="ltr">{permission.permission_key}</span></span></label>)}</div>
            <div className="space-y-3 border-t border-line p-4"><p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">تغيير الصلاحيات يؤثر فورًا في جميع المستخدمين المرتبطين بهذا الدور. لا يسمح النظام بإزالة آخر صلاحية system.admin نشطة.</p><label className="flex items-start gap-3 rounded-xl border border-line p-3 text-xs leading-5 text-slate-700"><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} className="mt-1 h-4 w-4 accent-brand-600" />أؤكد أن هذه التغييرات مقصودة وأدرك أثرها على الوصول إلى واجهات النظام.</label><div className="flex justify-end"><Button onClick={() => void save()} disabled={!changed || !confirm || saving}><Save size={16} />{saving ? "جارٍ الحفظ…" : "حفظ صلاحيات الدور"}</Button></div></div>
          </Panel>
        </div>
      </DataState>
    </>
  );
}
