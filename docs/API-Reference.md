# مرجع API — نظام إدارة شؤون الأفراد والمعسكرات

**الإصدار:** `/api/v1` — 2026-10-05
**نوع المحتوى:** مرجع يدوي مطابق للمسارات الحالية، وليس ملف OpenAPI مُولّدًا.

## 1. الأساسيات

- عنوان التطوير المحلي: `http://localhost:4000/api/v1`.
- المسارات المحمية تتطلب `Authorization: Bearer <JWT>`، وتتحقق الصلاحيات في الخادم.
- نوع الطلب/الاستجابة الافتراضي: `application/json`.
- لا ترسل كلمة المرور أو رمز JWT إلى سجلات التطبيق أو التدقيق أو عناوين URL.
- القاعدة الآمنة لكل API: استخدم بيانات اصطناعية فقط.

### مغلف الاستجابة

استجابة النجاح:

```json
{"status":"success","data":{"...":"..."},"error":null}
```

استجابة الإخفاق:

```json
{"status":"fail","data":null,"error":{"message":"...","details":{}}}
```

قد يكون `details` غائبًا. تُستخدم عادة رموز `200` للقراءة والتحديث، و`201` للإنشاء، و`400` للمدخلات غير الصالحة، و`401` للمصادقة، و`403` للصلاحية، و`404` للمورد غير الموجود، و`409` لتعارض سلامة البيانات، و`429` لتجاوز حد الدخول.

نقاط التنزيل `GET /reports/export` استثناء: تعيد ملف XLSX أو PDF خامًا مع `Content-Type` و`Content-Disposition` المناسبين، لا مغلف JSON.

## 2. المصادقة والصحة

| الطريقة والمسار | الغرض | الصلاحية / المدخل |
|---|---|---|
| `POST /auth/login` | الدخول وإصدار JWT | عام؛ Body `{ "username": string, "password": string }`. يحدّد المعدّل 20 محاولة لكل IP خلال 15 دقيقة. |
| `GET /auth/me` | استعادة المستخدم الحالي | Bearer؛ يتطلب أي صلاحية تطبيق واحدة على الأقل؛ يعيد معلومات الجلسة والصلاحيات. |
| `GET /health` | فحص liveness أدنى | عام؛ يعيد مغلف النجاح القياسي مع `data: { "ok": true }` فقط ولا يكشف حالة قاعدة البيانات. |

يُصدر JWT لمدة الجلسة المضبوطة؛ مدة FR-16 تسري على الدخول التالي فقط.

## 3. الأفراد

جميع عمليات الأفراد تتطلب `personnel.manage`.

| الطريقة والمسار | الغرض | المدخلات/النتيجة |
|---|---|---|
| `GET /personnel` | بحث وصفحات | Query اختياري: `page` (افتراضي 1)، `page_size` (افتراضي 20، الحد 100)، `search` (الاسم)، `camp_id`، `unit_id`، `rank_id`، `status`. يعيد `items`, `total`, `page`, `page_size`. |
| `POST /personnel` | إنشاء سجل | Body: `full_name` مطلوب؛ `national_id`, `date_of_birth`, `gender`, `phone`, `email`, `rank_id`, `unit_id`, `camp_id` اختيارية. يبدأ `current_status=active` ويُضاف سجل حالة أولي. |
| `PUT /personnel/:id` | تعديل حقول | حقل واحد على الأقل من حقول الفرد؛ الحقول القابلة للمسح تدعم `null` حيث ينص مخطط الطلب. |
| `DELETE /personnel/:id` | حذف منطقي | يضع `deleted_at` ويعطل السجل؛ لا يحذف الصف فعليًا. |
| `POST /personnel/:id/status` | تغيير الحالة | Body `{ "status": "active\|inactive\|on_leave\|transferred\|discharged", "notes"?: string }`. يحدّث الحالة الحالية ويضيف سجلًا تاريخيًا في معاملة. |
| `GET /personnel/:id/status` | التاريخ التراكمي للحالة | يعيد `items` مرتبة من الأحدث. |

## 4. البيانات المرجعية

تستخدم وحدات المعسكرات والوحدات والرتب والمناصب CRUD مع تدقيق. عمليات الكتابة تتطلب صلاحية الإدارة الخاصة بالوحدة. عمليات القراءة تسمح كذلك ببعض الأدوار التي تحتاج إلى تعبئة النماذج، كما هو موضح أدناه.

| المورد | قراءة GET | كتابة POST/PUT/DELETE | الحقول الأساسية للإنشاء |
|---|---|---|---|
| `/camps` | `camps.manage`, `personnel.manage`, `units.manage`, `transfers.manage` | `camps.manage` | `{name, capacity?, location?}`؛ السعة عدد صحيح غير سالب. |
| `/units` | `units.manage`, `personnel.manage`, `assignments.manage`, `positions.manage`, `transfers.manage` | `units.manage` | `{name, camp_id, parent_unit_id?}`؛ يجب أن ينتمي الأب إلى المعسكر نفسه وألا ينتج تسلسل دائري. |
| `/ranks` | `ranks.manage`, `personnel.manage` | `ranks.manage` | `{name, level, description?}`. |
| `/positions` | `positions.manage`, `personnel.manage`, `assignments.manage` | `positions.manage` | `{name, unit_id?, description?}`. |

لكل مجموعة: `GET /`، `POST /`، `PUT /:id`، `DELETE /:id`. قد يرفض الحذف إذا ارتبط السجل ببيانات أخرى.

## 5. التعيينات

تتطلب جميعها `assignments.manage`.

| الطريقة والمسار | الغرض | المدخلات/النتيجة |
|---|---|---|
| `GET /assignments` | قائمة التعيينات التاريخية | `items` مع أسماء الفرد والوحدة والمنصب. |
| `GET /assignments/eligible-personnel` | خيارات محدودة للفرد | يعيد `personnel_id` و`full_name` فقط للسجلات النشطة غير المحذوفة. |
| `POST /assignments` | إضافة تعيين | `{personnel_id, unit_id, position_id, start_date?, end_date?, notes?}`. تُغلق الوظيفة الحالية السابقة وتُحدّث وحدة/معسكر الفرد ضمن تكامل ذري. |

## 6. الانتقالات

تتطلب `transfers.manage`.

| الطريقة والمسار | الغرض | المدخلات/النتيجة |
|---|---|---|
| `GET /transfers` | سجل الانتقالات | `items` مع مراجع الفرد والمعسكرين. |
| `GET /transfers/eligible-personnel` | أفراد صالحون للاختيار | يقتصر على النشطين غير المحذوفين ويعيد بيانات مختارة. |
| `POST /transfers` | تنفيذ انتقال | `{personnel_id, camp_from_id, camp_to_id, unit_to_id, reason?}`. يرفض تساوي المصدر والوجهة، ويتحقق من المعسكر الحالي والوحدة والسعة، ثم يحفظ النقل والفرد والتدقيق ذريًا؛ الحالة بعد التأكيد `completed` مباشرة. |

## 7. المستخدمون والأدوار

تتطلب `users.manage`.

| الطريقة والمسار | الغرض | المدخلات/النتيجة |
|---|---|---|
| `GET /users` | قائمة حسابات آمنة | لا يعيد `password_hash`. |
| `GET /users/roles` | كتالوج الأدوار لمحرر المستخدم | أدوار وصلاحيات مختارة. |
| `POST /users` | إنشاء حساب | `{username, password, full_name, email?, role_ids?}`؛ تُفرض سياسة FR-16، وتخزّن التجزئة فقط. |
| `PUT /users/:id` | تحديث ملف/أدوار/تفعيل/كلمة مرور | أي من `full_name`, `email`, `is_active`, `password`, `role_ids`؛ لا بد من حقل واحد على الأقل. كلمة المرور الجديدة تخضع للسياسة. |
| `GET /roles` | قائمة الأدوار | يتضمن الصلاحيات وعدد الحسابات لكل دور. |
| `GET /roles/permissions` | قائمة الصلاحيات | مفاتيح الصلاحيات المتاحة. |
| `PUT /roles/:id/permissions` | استبدال صلاحيات دور | Body `{ "permission_ids": number[] }`. يمنع ترك النظام بلا مدير نشط ويكتب سجل تدقيق. |

لا توجد عملية حذف حساب عبر API؛ استخدم التعطيل. لا تغيّر صلاحيات المدير الأخير إلى وضع يزيل `system.admin` عنه.

## 8. لوحة التحكم والتقارير

تتطلب `reports.view`.

| الطريقة والمسار | الغرض | Query / النتيجة |
|---|---|---|
| `GET /reports/summary` | مؤشرات لوحة التحكم | يقبل `from`, `to`, `camp_id`, `status`; يعيد الإجمالي، النشط، `status_breakdown`, التوزيع حسب المعسكر والرتبة، آخر الانتقالات، قائمة المعسكرات المتاحة، والفلاتر المعتمدة. |
| `GET /reports/export` | تنزيل تقرير | `format=xlsx` أو `format=pdf`؛ يقبل الفلاتر نفسها ويطبقها على التصدير. الافتراضي XLSX. يسجل الحدث والفلاتر في التدقيق. |

`from` و`to` تاريخان قابلان للتحليل؛ يجب ألا يكون `from` بعد `to`. يرشحان تاريخ إنشاء سجل الفرد وتاريخ طلب الانتقال. يرشح `camp_id` الأفراد حسب معسكرهم الحالي والانتقالات التي يكون المعسكر مصدرها أو وجهتها. يرشح `status` الحالة الحالية للأفراد. القيم المسموحة: `active`, `inactive`, `on_leave`, `transferred`, `discharged`.

## 9. سجل التدقيق والإشعارات

| الطريقة والمسار | الصلاحية | الغرض |
|---|---|---|
| `GET /audit` | `system.admin` | Query: `page`, `page_size`, `user_id`, `action_type`, `target_table`, `from`, `to`. يتحقق من التاريخ والترتيب؛ القراءة نفسها تسجل `AuditLogViewed`. لا توجد مسارات تعديل/حذف للتدقيق. |
| `GET /notifications` | Bearer وأي صلاحية تطبيق | Query: `unread=true` اختياري؛ النتيجة خاصة بالمستخدم الحالي وبحد أقصى 100 إشعار. يعيد أيضًا عدد غير المقروء. |
| `PATCH /notifications/:id/read` | Bearer وأي صلاحية تطبيق | يعلّم إشعار المستخدم الحالي فقط كمقروء. |
| `PATCH /notifications/read-all` | Bearer وأي صلاحية تطبيق | يعلّم كل إشعارات المستخدم الحالي كمقروءة. |

## 10. إعدادات النظام FR-16

| الطريقة والمسار | الصلاحية | المدخلات/النتيجة |
|---|---|---|
| `GET /settings/password-policy` | `users.manage` أو `system.admin` | يعيد حدود كلمة المرور فقط، دون مدة الجلسة. |
| `GET /settings` | `system.admin` | يعيد إعدادات النظام كاملة. |
| `PUT /settings` | `system.admin` | `{passwordMinLength: 8..64, requireUppercase: boolean, requireNumber: boolean, requireSymbol: boolean, sessionDurationHours: 1..24}`. يُسجل السابق والجديد ضمن معاملة واحدة. |

تسري سياسة كلمة المرور على كلمات المرور الجديدة أو المعاد تعيينها، وتؤثر مدة الجلسة على JWT اللاحق، لا الرموز النشطة.

## 11. مراجع التنفيذ

- موصلات Express: [`server/src/app.ts`](../server/src/app.ts)، [`server/src/routes/`](../server/src/routes/).
- مخططات Zod: [`server/src/validators/schemas.ts`](../server/src/validators/schemas.ts).
- وصف استخدام الشاشة: [`User-Guide.ar.md`](User-Guide.ar.md).
- تحقق الاختبارات والحدود: [`Testing-Report.md`](Testing-Report.md).
