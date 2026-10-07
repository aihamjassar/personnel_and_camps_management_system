import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  ShieldCheck,
  UserRound,
  UsersRound,
  BriefcaseBusiness,
  Medal,
  Bell,
  ArrowLeftRight,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/app/dashboard", label: "لوحة التحكم", permission: "reports.view", icon: LayoutDashboard },
  { to: "/app/personnel", label: "إدارة الأفراد", permission: "personnel.manage", icon: UsersRound },
  { to: "/app/camps", label: "المعسكرات", permission: "camps.manage", icon: MapPinned },
  { to: "/app/units", label: "الوحدات التنظيمية", permission: "units.manage", icon: Building2 },
  { to: "/app/ranks", label: "الرتب", permission: "ranks.manage", icon: Medal },
  { to: "/app/positions", label: "المناصب", permission: "positions.manage", icon: BriefcaseBusiness },
  { to: "/app/assignments", label: "التعيينات", permission: "assignments.manage", icon: ClipboardList },
  { to: "/app/transfers", label: "الانتقالات", permission: "transfers.manage", icon: ArrowLeftRight },
  { to: "/app/users", label: "المستخدمون", permission: "users.manage", icon: ShieldCheck },
  { to: "/app/roles", label: "الأدوار والصلاحيات", permission: "users.manage", icon: ShieldCheck },
  { to: "/app/audit", label: "سجل التدقيق", permission: "system.admin", icon: ClipboardList },
  { to: "/app/settings", label: "إعدادات النظام", permission: "system.admin", icon: SettingsIcon },
  { to: "/app/notifications", label: "الإشعارات", permission: "", icon: Bell },
];

export default function AppLayout() {
  const { user, signOut, can } = useAuth();
  const visibleLinks = links.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="min-h-screen bg-paper text-ink lg:flex">
      <aside className="border-b border-line bg-white lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:flex lg:w-72 lg:flex-col lg:border-b-0 lg:border-l">
        <div className="flex items-center gap-3 px-5 py-5 lg:px-6 lg:py-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20"><UsersRound size={23} /></span>
          <div><p className="text-sm font-black leading-6 text-ink">إدارة الأفراد</p><p className="text-xs text-muted">والمعسكرات · نسخة أكاديمية</p></div>
        </div>
        <div className="px-5 pb-3 lg:px-4"><p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">بيئة تجريبية — استخدم بيانات افتراضية فقط</p></div>
        <nav aria-label="التنقل الرئيسي" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-4 lg:py-2">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition lg:w-full ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-line p-4 lg:block">
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-700 ring-1 ring-line"><UserRound size={18} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user?.full_name ?? user?.username ?? "مستخدم"}</p><p className="truncate text-xs text-muted">{user?.username}</p></div>
          </div>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700"><LogOut size={17} />تسجيل الخروج</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:mr-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur sm:px-7 lg:px-10">
          <div><p className="text-xs text-muted">مساحة العمل</p><p className="text-sm font-extrabold text-ink">النظام الداخلي</p></div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:inline-flex">بيانات تجريبية</span>
            <button onClick={signOut} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-rose-50 hover:text-rose-700 lg:hidden" aria-label="تسجيل الخروج"><LogOut size={18} /></button>
            <div className="hidden text-left sm:block"><p className="text-sm font-bold">{user?.full_name ?? user?.username}</p><p className="text-xs text-muted">{user?.username}</p></div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-10"><Outlet /></div>
        <footer className="mx-auto max-w-[1440px] px-4 pb-7 text-center text-xs text-muted sm:px-6 lg:px-10">مشروع أكاديمي ببيانات افتراضية فقط · جميع الحقوق لأغراض تعليمية</footer>
      </main>
    </div>
  );
}
