const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('query_string', { sql: 'SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname = \'reports_category_check\'' });

  if (error) {
    console.log("RPC failed", error.message);
    const { data: rows, error: rErr } = await supabase.from('reports').select('*').limit(1);
    console.log("Rows:", rows, "Error:", rErr);
  } else {
    console.log("Constraint:", data);
  }
}
check();
