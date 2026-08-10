const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runEgressReport() {
  console.log('=== SSCBS OS: SUPABASE EGRESS & USAGE AUDIT ===');
  console.log('Target Instance:', supabaseUrl);
  console.log('Timestamp:', new Date().toISOString());
  console.log('--------------------------------------------------');

  const tables = [
    'analytics_events',
    'notices',
    'active_presence',
    'squad_posts',
    'squad_applications',
    'app_config',
    'profiles',
    'admin_whitelist'
  ];

  const tableStats = [];

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(100);

      if (error) {
        tableStats.push({ table, status: 'Error / Missing', error: error.message, count: 0, avgRowSizeBytes: 0, estTotalSizeBytes: 0 });
        continue;
      }

      const totalRows = count || (data ? data.length : 0);
      let avgSize = 0;
      if (data && data.length > 0) {
        const totalSampleBytes = JSON.stringify(data).length;
        avgSize = Math.round(totalSampleBytes / data.length);
      }

      tableStats.push({
        table,
        status: 'OK',
        count: totalRows,
        avgRowSizeBytes: avgSize,
        estTotalSizeBytes: totalRows * avgSize
      });
    } catch (err) {
      tableStats.push({ table, status: 'Exception', error: err.message, count: 0, avgRowSizeBytes: 0, estTotalSizeBytes: 0 });
    }
  }

  // Check RPC get_analytics_summary
  let rpcStatus = 'Not Available';
  let rpcEgressSavings = 'N/A';
  try {
    const startIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_analytics_summary', { start_date: startIso });
    if (!rpcErr && rpcData) {
      rpcStatus = 'Active & Working';
      const rpcPayloadSize = JSON.stringify(rpcData).length;
      const rawEventsCount = tableStats.find(t => t.table === 'analytics_events')?.count || 0;
      const rawPayloadEstimate = rawEventsCount * 120; // ~120 bytes per row
      if (rawPayloadEstimate > 0) {
        const savingsPercent = (((rawPayloadEstimate - rpcPayloadSize) / rawPayloadEstimate) * 100).toFixed(2);
        rpcEgressSavings = `${savingsPercent}% payload reduction (${rawPayloadEstimate} bytes raw vs ${rpcPayloadSize} bytes aggregated)`;
      }
    } else {
      rpcStatus = `RPC Error: ${rpcErr?.message || 'Unknown'}`;
    }
  } catch (e) {
    rpcStatus = `RPC Exception: ${e.message}`;
  }

  console.log('\nTABLE AUDIT SUMMARY:');
  console.table(tableStats.map(t => ({
    Table: t.table,
    Status: t.status,
    'Row Count': t.count,
    'Avg Row Size (B)': t.avgRowSizeBytes,
    'Est Table Footprint (KB)': (t.estTotalSizeBytes / 1024).toFixed(2)
  })));

  console.log('\nRPC AGGREGATION AUDIT:');
  console.log('Status:', rpcStatus);
  console.log('Egress Efficiency:', rpcEgressSavings);

  console.log('\nAudit complete.');
}

runEgressReport().catch(console.error);
