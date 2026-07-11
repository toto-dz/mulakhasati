-- ============================================================================
--  مخطط Supabase لمنصة ملخصاتي
--  شغّل هذا السكربت في Supabase → SQL Editor.
--  المتصفح (GitHub Pages) يتصل مباشرة بـ Supabase، فالحماية عبر RLS.
-- ============================================================================

-- ---------- جدول الملخصات ----------
create table if not exists public.summaries (
  id            bigint generated always as identity primary key,
  title         text not null default '',
  description   text not null default '',
  subject       text not null default '',
  cover_prompt  text not null default '',
  section       text not null default '',
  level         text not null default '',
  year          text not null default '',
  pages         integer not null default 0,
  size          text not null default '',
  author        text not null default '',
  cover_image   text not null default '',
  page_images   jsonb not null default '[]'::jsonb,
  tags          jsonb not null default '[]'::jsonb,
  pdf_url       text not null default '',
  pdf_name      text not null default '',
  created_at    timestamptz not null default now(),
  status        text not null default 'منشور'
);

create index if not exists summaries_subject_idx on public.summaries (subject);
create index if not exists summaries_level_idx   on public.summaries (level);
create index if not exists summaries_year_idx    on public.summaries (year);
create index if not exists summaries_status_idx  on public.summaries (status);

-- ---------- جدول كروت الصفحة الرئيسية ----------
create table if not exists public.featured (
  id          bigint generated always as identity primary key,
  title       text not null default '',
  description text not null default '',
  cover_image text not null default '',
  icon        text not null default 'auto_stories',
  badge       text not null default '',
  color       text not null default 'primary',
  subject     text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------- جدول إعدادات OpenRouter (مفتاح سري لكل مستخدم) ----------
create table if not exists public.settings (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  openrouter_key   text not null default '',
  openrouter_model text not null default '',
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

-- ============================ سياسات الأمان (RLS) ============================

alter table public.summaries enable row level security;
alter table public.featured  enable row level security;
alter table public.settings  enable row level security;

-- القراءة للجميع (الواجهة العامة)
create policy "الملخصات قابلة للقراءة للجميع"
  on public.summaries for select using (true);
create policy "الكروت قابلة للقراءة للجميع"
  on public.featured for select using (true);

-- الكتابة للمستخدمين المصادقين فقط (المشرفون)
create policy "كتابة الملخصات للمصادقين"
  on public.summaries for all
  using ( auth.role() = 'authenticated' )
  with check ( auth.role() = 'authenticated' );

create policy "كتابة الكروت للمصادقين"
  on public.featured for all
  using ( auth.role() = 'authenticated' )
  with check ( auth.role() = 'authenticated' );

-- الإعدادات: يراها/يعدّلها صاحبها فقط
create policy "إعدادات المستخدم لنفسه"
  on public.settings for all
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- ============================ التخزين (Storage Buckets) ============================

insert into storage.buckets (id, name, public) values
  ('covers', 'covers', true),
  ('pages',  'pages',  true),
  ('pdfs',   'pdfs',   true)
on conflict (id) do nothing;

-- القراءة عامة تلقائيًا (لأن الـ buckets عامة)؛ نضيف سياسات الرفع للمصادقين
create policy "رفع الملفات للمصادقين"
  on storage.objects for insert to authenticated
  with check ( bucket_id in ('covers', 'pages', 'pdfs') );

create policy "تعديل الملفات للمصادقين"
  on storage.objects for update to authenticated
  using ( bucket_id in ('covers', 'pages', 'pdfs') );

create policy "حذف الملفات للمصادقين"
  on storage.objects for delete to authenticated
  using ( bucket_id in ('covers', 'pages', 'pdfs') );
