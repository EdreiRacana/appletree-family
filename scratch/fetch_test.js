const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../apps/web/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data: members, error } = await supabase.from('members').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Members:', members);
  const { data: trees } = await supabase.from('trees').select('*').order('created_at', { ascending: false }).limit(2);
  console.log('Trees:', trees);
})();
