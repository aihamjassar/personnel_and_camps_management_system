import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { Button, Field, inputClass } from "../components/ui";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#f3f7fc] lg:grid-cols-[1fr_1.05fr]" dir="rtl">
      <div aria-hidden="true" className="pointer-events-none absolute -left-36 -top-40 h-[30rem] w-[30rem] rounded-full bg-brand-100/70 blur-3xl" />
      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:order-2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white"><UsersRound size={23} /></span>
            <div><p className="font-black text-ink">نظام إدارة الأفراد</p><p className="text-sm text-muted">والمعسكرات</p></div>
          </div>
          <div className="rounded-[2rem] border border-white bg-white p-6 shadow-[0_24px_70px_rgba(24,44,78,.12)] sm:p-9">
            <div className="mb-7">
              <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><LockKeyhole size={22} /></span>
              <p className="text-sm font-bold text-brand-600">مرحبًا بعودتك</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">تسجيل الدخول</h1>
              <p className="mt-2 text-sm leading-6 text-muted">أدخل بيانات حسابك للوصول إلى مساحة العمل.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <Field label="اسم المستخدم">
                <input autoComplete="username" required maxLength={100} value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass()} placeholder="اسم المستخدم" />
              </Field>
              <Field label="كلمة المرور">
                <input autoComplete="current-password" required type="password" maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass()} placeholder="كلمة المرور" />
              </Field>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full justify-between py-3">
                <span>{submitting ? "جارٍ التحقق…" : "دخول إلى النظام"}</span><ArrowLeft size={17} />
              </Button>
            </form>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p>نظام أكاديمي تجريبي. لا تُدخل بيانات حقيقية أو حساسة.</p></div>
          </div>
          <p className="mt-5 text-center text-xs text-muted">جامعة تعز · كلية الحاسوب وتقنية المعلومات · نسخة تعليمية</p>
        </div>
      </section>
      <section className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#102744] px-10 py-12 text-white lg:order-1 lg:flex">
        <div aria-hidden="true" className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 25% 20%, #60a5fa 0 1px, transparent 1.5px)", backgroundSize: "32px 32px" }} />
        <div aria-hidden="true" className="absolute -bottom-40 -right-24 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-24 -right-10 h-[25rem] w-[25rem] rounded-full border border-white/10" />
        <div className="relative max-w-xl">
          <div className="mb-12 flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20"><UsersRound size={27} /></span><div><p className="text-lg font-black">نظام إدارة الأفراد</p><p className="text-sm text-blue-100/70">والمعسكرات</p></div></div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-100"><span className="h-2 w-2 rounded-full bg-teal-400" />بيئة أكاديمية تجريبية</div>
          <h2 className="text-5xl font-black leading-[1.35] tracking-tight">إدارة واضحة،<br /><span className="text-blue-300">وقرارات أدق.</span></h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-blue-100/75">مساحة موحّدة لتنظيم السجلات الإدارية الأساسية، مع صلاحيات واضحة وتجربة عربية من اليمين إلى اليسار.</p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {["صلاحيات حسب الدور", "سجل تاريخي للحالات", "ملخصات إدارية", "بيانات تجريبية آمنة"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-blue-50"><span className="h-1.5 w-1.5 rounded-full bg-teal-300" />{item}</div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
