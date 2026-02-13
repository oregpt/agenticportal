const { Client } = require('pg');

const connectionString = 'postgresql://postgres:ruwMDqlpXtKRPJsOQgVZNHCvQPHVGEyO@ballast.proxy.rlwy.net:55779/railway';

async function explore() {
  const client = new Client({ connectionString });
  await client.connect();
  
  // Sample data from users
  console.log('👤 SAMPLE USERS');
  console.log('─'.repeat(50));
  const users = await client.query('SELECT id, email, name, "platformRole" FROM users LIMIT 5');
  users.rows.forEach(u => console.log(`  ${u.email} | ${u.name || 'No name'} | ${u.platformRole}`));
  
  // Sample orgs
  console.log('\n🏢 SAMPLE ORGANIZATIONS');
  console.log('─'.repeat(50));
  const orgs = await client.query('SELECT id, name, slug, "isActive" FROM organizations LIMIT 10');
  orgs.rows.forEach(o => console.log(`  ${o.name} (${o.slug}) ${o.isActive ? '✅' : '❌'}`));
  
  // Scenarios
  console.log('\n🎯 SAMPLE SCENARIOS');
  console.log('─'.repeat(50));
  const scenarios = await client.query('SELECT name, description FROM scenarios LIMIT 5');
  scenarios.rows.forEach(s => console.log(`  ${s.name}: ${s.description || 'No description'}`));
  
  // Datasets
  console.log('\n📁 SAMPLE DATASETS');
  console.log('─'.repeat(50));
  const datasets = await client.query('SELECT name, "sourceType", status, "totalRows" FROM datasets LIMIT 5');
  datasets.rows.forEach(d => console.log(`  ${d.name} | ${d.sourceType} | ${d.status} | ${d.totalRows || 0} rows`));
  
  await client.end();
}

explore().catch(console.error);
