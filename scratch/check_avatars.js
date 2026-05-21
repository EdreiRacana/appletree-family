const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('members').select('id, first_name, last_name, avatar_url').ilike('first_name', '%eber%');
  console.log('Eber:', data, error);

  const { data: data2, error: error2 } = await supabase.from('members').select('id, first_name, last_name, avatar_url').ilike('first_name', '%francisco%');
  console.log('Francisco:', data2, error2);
}

check();
