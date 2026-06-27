const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const PAYATAS_CENTER = { lat: 14.7055, lng: 121.0990 };
const categories = ["flooding", "fire", "crime", "infrastructure", "health", "environmental", "other"];

async function seed() {
  const reports = [];
  const now = new Date();

  for (let i = 0; i < 80; i++) {
    let lat, lng;
    if (Math.random() > 0.3) {
      const hotspotLat = PAYATAS_CENTER.lat + (i % 3 - 1) * 0.003;
      const hotspotLng = PAYATAS_CENTER.lng + ((i + 1) % 3 - 1) * 0.003;
      lat = hotspotLat + (Math.random() - 0.5) * 0.001;
      lng = hotspotLng + (Math.random() - 0.5) * 0.001;
    } else {
      lat = PAYATAS_CENTER.lat + (Math.random() - 0.5) * 0.01;
      lng = PAYATAS_CENTER.lng + (Math.random() - 0.5) * 0.01;
    }

    const created_at = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();

    const category = categories[Math.floor(Math.random() * categories.length)];

    reports.push({
      receipt_id: `REP-${Math.floor(Math.random() * 100000)}`,
      category: category,
      severity: Math.floor(Math.random() * 10) + 1, // 1 to 10 severity
      created_at: created_at,
      latitude: lat,
      longitude: lng,
      status: "pending",
      reporter_hash: `mock-reporter-${Math.floor(Math.random() * 100)}`,
      description: `Auto-generated dummy report for testing ${category}.`
    });
  }

  const { data, error } = await supabase.from('reports').insert(reports);

  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log("Successfully inserted 80 mock reports.");
  }
}

seed();
