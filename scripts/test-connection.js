const { supabase } = require('../src/integrations/supabase/client.js');

(async () => {
  try {
    const { count, error } = await supabase
      .from('summaries')
      .select('*', {
        count: 'exact',
        head: true
      });

    if (error) {
      console.error("❌ فشل الاتصال:", error.message);
      process.exit(1);
    }

    console.log("✅ الاتصال بـ Supabase ناجح");
    console.log("📄 عدد الملخصات:", count);

  } catch (err) {
    console.error("❌ خطأ:", err.message);
    process.exit(1);
  }
})();