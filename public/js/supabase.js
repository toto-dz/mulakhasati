import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

console.log('URL:', SUPABASE_URL);
console.log('KEY:', SUPABASE_ANON_KEY.substring(0, 20));

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase
  .from('summaries')
  .select('*')
  .limit(1);

console.log(data);
console.log(error);
