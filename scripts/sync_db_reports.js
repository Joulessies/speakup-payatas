const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const k = match[1].trim();
      const v = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function sync() {
  console.log('Fetching live reports from Supabase database...');
  const { data, error } = await supabase
    .from('reports')
    .select('id, category, admin_category, description, verification_status, created_at')
    .neq('verification_status', 'spam');

  if (error) {
    console.error('Failed to fetch from Supabase:', error.message);
    process.exit(1);
  }

  const validReports = data.filter(r => 
    r.description && 
    r.description.trim().length >= 3 && 
    (r.admin_category || r.category) &&
    (r.admin_category !== 'other' || r.category !== 'other')
  );

  const outputPath = path.join(__dirname, '..', 'data', 'database_reports.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    synced_at: new Date().toISOString(),
    total_fetched: data.length,
    usable_training_samples: validReports.length,
    reports: validReports
  }, null, 2), 'utf-8');

  console.log(`Saved ${validReports.length} database reports to data/database_reports.json`);
}

sync();
