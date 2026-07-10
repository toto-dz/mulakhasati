require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

if (typeof globalThis.WebSocket === 'undefined') {
  try {
    const ws = require('ws');
    globalThis.WebSocket = ws;
  } catch {
    // ws not available, realtime features won't work
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبان في ملف .env');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase };
