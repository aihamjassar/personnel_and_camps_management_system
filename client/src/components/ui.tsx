import { X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-white border border-line text-ink hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "bg-transparent text-muted hover:bg-slate-100 hover:text-ink",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-white shadow-soft ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-brand-600">نظام إدارة الأفراد والمعسكرات</p>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({ label, value, hint, icon: Icon, tone = "blue" }: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  tone?: "blue" | "teal" | "amber" | "violet";
}) {
  const tones = {
    blue: "bg-brand-50 text-brand-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="mt-3 text-3xl font-black tabular-nums text-ink">{value}</p>
          <p className="mt-2 text-xs text-muted">{hint}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={21} /></span>
      </div>
    </Panel>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    on_leave: "في إجازة",
    transferred: "منقول",
    discharged: "منتهي الخدمة",
    pending: "قيد المراجعة",
    approved: "مقبول",
    rejected: "مرفوض",
    completed: "مكتمل",
  };
  const style = value === "active" || value === "approved" || value === "completed"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : value === "on_leave" || value === "pending"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${style}`}>{labels[value] ?? value}</span>;
}

export function DataState({ loading, error, empty, onRetry, children }: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) return <div className="grid min-h-52 place-items-center text-sm font-semibold text-muted" role="status">جارٍ تحميل البيانات…</div>;
  if (error) return (
    <div className="grid min-h-52 place-items-center p-6 text-center" role="alert">
      <div><p className="font-bold text-rose-700">تعذّر تحميل البيانات</p><p className="mt-2 text-sm text-muted">{error}</p><Button variant="secondary" onClick={onRetry} className="mt-4">إعادة المحاولة</Button></div>
    </div>
  );
  if (empty) return <div className="grid min-h-52 place-items-center p-6 text-center"><div><p className="font-bold text-ink">لا توجد بيانات بعد</p><p className="mt-2 text-sm text-muted">يمكنك إضافة أول سجل من الزر أعلى الصفحة.</p></div></div>;
  return <>{children}</>;
}

export function Modal({ title, description, onClose, children, wide = false }: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const getFocusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    getFocusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7 ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 id="modal-title" className="text-xl font-black text-ink">{title}</h2>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block text-sm font-bold text-ink"><span className="mb-2 block">{label}</span>{children}{hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}</label>;
}

export function inputClass() {
  return "min-h-11 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";
}

export function EmptyTableRow({ columns, message = "لا توجد سجلات مطابقة" }: { columns: number; message?: string }) {
  return <tr><td colSpan={columns} className="px-4 py-12 text-center text-sm text-muted">{message}</td></tr>;
}


export function DataTable({ children }: { children: ReactNode }) {
  return <div className="table-wrap"><table className="data-table">{children}</table></div>;
}
