import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Button, DataState, PageHeader, Panel } from "../components/ui";

interface NotificationItem {
  notification_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<{ items: NotificationItem[]; unread: number }>("/notifications");
      setItems(result.items);
      setUnread(result.unread);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل الإشعارات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: number) {
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحديث الإشعار.");
    }
  }

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحديث الإشعارات.");
    }
  }

  return (
    <>
      <PageHeader title="الإشعارات" subtitle="آخر الأحداث المهمة الموجّهة إلى حسابك." action={<Button variant="secondary" onClick={() => void markAllRead()} disabled={unread === 0}><CheckCheck size={16} />تعليم الكل كمقروء</Button>} />
      <Panel className="divide-y divide-slate-100">
        <DataState loading={loading} error={error} empty={!loading && !error && items.length === 0} onRetry={() => void load()}>
          {items.map((item) => (
            <div key={item.notification_id} className={`flex items-start justify-between gap-4 p-5 ${item.is_read ? "opacity-70" : "bg-brand-50/40"}`}>
              <div className="min-w-0">
                <p className="font-black text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                <p className="mt-2 text-xs text-muted">{dateFmt.format(new Date(item.created_at))}</p>
              </div>
              {!item.is_read && <button onClick={() => void markRead(item.notification_id)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-line hover:bg-brand-50">تعليم كمقروء</button>}
            </div>
          ))}
        </DataState>
      </Panel>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted"><Bell size={14} /> غير المقروء: {new Intl.NumberFormat("ar").format(unread)}</div>
    </>
  );
}
