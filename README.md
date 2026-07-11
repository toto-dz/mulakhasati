# ملخصاتي (Mulakhkhasati)

منصة ملخصات دراسية. واجهة أمامية ثابتة (مناسبة لـ GitHub Pages) تتصل **مباشرة**
بـ Supabase عبر `@supabase/supabase-js` — **بدون أي خادم وسيط** (لا يوجد `server.js`).

```
المتصفح (GitHub Pages)
        │
        ▼
   Supabase (Postgres + Storage + Auth)
```

## البنية

| المجلد/الملف | الوصف |
|---|---|
| `public/` | كامل واجهة الموقع (HTML/CSS/JS). يُنشر كما هو. |
| `js/supabase.js` | عميل Supabase (يُحمَّل عبر ESM CDN). |
| `js/supabase-config.js` | `SUPABASE_URL` + `SUPABASE_ANON_KEY` (مفتاح عام). |
| `js/api.js` | طبقة البيانات: قراءة/كتابة الجداول + رفع الملفات لـ Storage. |
| `js/auth.js` + `auth-guard.js` | مصادقة المشرفين عبر Supabase Auth. |
| `services/aiService.js` | ميزات الذكاء الاصطناعي (OpenRouter) + إعداداته في Supabase. |
| `sql/schema.sql` | مخطط قاعدة البيانات + الـ Buckets + سياسات RLS. |
| `scripts/migrate-to-supabase.mjs` | نقل البيانات المحلية القديمة إلى Supabase. |

## الإعداد

1. **أنشئ مشروعًا في Supabase** وانسخ `Project URL` و `anon public key`.
2. **شغّل `sql/schema.sql`** في Supabase → SQL Editor (ينشئ الجداول، الـ Buckets، وسياسات RLS).
3. **عدّل `js/supabase-config.js`** وضع فيه رابط المشروع والمفتاح العام:

   ```js
   export const SUPABASE_URL = 'https://PROJECT_ID.supabase.co';
   export const SUPABASE_ANON_KEY = 'ANON_PUBLIC_KEY';
   ```

4. **أنشئ مستخدم مشرف** في Supabase → Authentication (Email/Password). سجّل الدخول
   من `login.html`. البيانات محمية بـ RLS: القراءة للجميع، والكتابة للمستخدمين المصادقين فقط.

## الذكاء الاصطناعي (OpenRouter)

مفتاح OpenRouter يُحفظ في جدول `settings` (كل مستخدم يرى إعداداته فقط عبر RLS)،
ويُستدعى OpenRouter **مباشرة من المتصفح** للمشرف المسجّل (لا يوجد خادم لإخفاء المفتاح).
أضف المفتاح والنموذج من صفحة `ai-settings.html`.

## النشر على GitHub Pages

GitHub Pages يخدم عادةً من جذر المستودع أو مجلد `docs/`. بما أن الموقع داخل `public/`،
اختر أحد الخيارين:

- **الأسهل:** انشر محتوى مجلد `public/` كجذر الموقع (عبر GitHub Action ينسخ `public/` إلى
  فرع النشر/الجذر)، أو اجعل مصدر النشر هو `public/`.
- أو انقل محتوى `public/` إلى جذر المستودع.

الموقع ثابت تمامًا ولا يحتاج أي خطوة بناء (build).

## نقل البيانات القديمة (اختياري)

إن كان لديك `data/*.json` و`images/`, `pdf/` من النسخة القديمة:

```bash
npm install
# ضع SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env
npm run migrate
```

السكربت (`scripts/migrate-to-supabase.mjs`) يرفع الصور/PDF إلى Storage ويحوّل روابطها
إلى روابط عامة، وينقل الملخصات والكروت والإعدادات.

## ملاحظات أمنية

- المفتاح العام (`anon`) منشور في المتصفح — هذا متوقع لموقع ثابت، والحماية عبر **RLS**.
- لا تمنح صلاحيات كتابة للزوار في سياسات RLS؛ الكتابة للمصادقين فقط.
- مفتاح `service_role` يُستخدم **فقط** في سكربت النقل المحلي ولا يُرفع للمتصفح أبدًا.
