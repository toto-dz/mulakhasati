// public/js/supabase.js
//
// عميل Supabase للواجهة الأمامية. يُحمَّل @supabase/supabase-js عبر ESM CDN
// (لا حاجة لخطوة بناء/build؛ يعمل مباشرة على GitHub Pages).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT')) {
  // eslint-disable-next-line no-console
  console.error(
    '⚠️ لم يتم ضبط بيانات Supabase. عدّل الملف public/js/supabase-config.js بمعلومات مشروعك.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
