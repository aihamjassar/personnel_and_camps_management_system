import type { ApiEnvelope } from "./types";

const API_BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const token = sessionStorage.getItem("personnel.session.token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("تعذّر الاتصال بالخادم. تحقق من تشغيل الخدمة ثم أعد المحاولة.", 0);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("أعاد الخادم استجابة غير متوقعة.", response.status);
  }

  if (!response.ok || envelope.status !== "success" || envelope.data === null) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent("personnel:session-expired"));
    }
    throw new ApiError(
      envelope.error?.message ?? "تعذّر إكمال الطلب.",
      response.status,
      envelope.error?.details,
    );
  }
  return envelope.data;
}

export const api = {
  get: <T,>(path: string) => apiRequest<T>(path),
  post: <T,>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T,>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T,>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

export function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
