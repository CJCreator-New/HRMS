import { readFileSync } from 'fs';

const sql = readFileSync('schema/01_rbac.sql', 'utf8');
const ts = readFileSync('src/lib/auth/permissions-map.ts', 'utf8');
const routeConfig = readFileSync('src/lib/nav/routeConfig.ts', 'utf8');
const mockRbac = readFileSync('src/lib/services/mock-rbac.ts', 'utf8');

const roles = ['employee','manager','hr','payroll_admin','system_admin','statutory_admin','finance_admin','it_admin'];

// ─── 1. Permission Catalog Sync ─────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  AUDIT 1: Permission Catalog (SQL ↔ TS)');
console.log('═══════════════════════════════════════════════════════════════');

const sqlPerms = new Set();
const permInsert = sql.substring(sql.indexOf('insert into permissions'));
for (const m of permInsert.matchAll(/'([a-z][a-z0-9_.]+)'/g)) {
  if (m[1].includes('.')) sqlPerms.add(m[1]);
}

const tsPerms = new Set();
for (const m of ts.matchAll(/"([a-z][a-z0-9_]*\.[a-z0-9_.]+)"/g)) {
  tsPerms.add(m[1]);
}

const sqlOnly = [...sqlPerms].filter(p => !tsPerms.has(p)).sort();
const tsOnly = [...tsPerms].filter(p => !sqlPerms.has(p)).sort();

console.log(`  SQL: ${sqlPerms.size} permissions | TS: ${tsPerms.size} permissions`);
if (sqlOnly.length) { console.log('  ❌ In SQL not in TS:', sqlOnly.join(', ')); }
if (tsOnly.length) { console.log('  ❌ In TS not in SQL:', tsOnly.join(', ')); }
if (!sqlOnly.length && !tsOnly.length) console.log('  ✅ IN SYNC');

// ─── 2. Role Grants Sync ────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  AUDIT 2: Role Grants (SQL ↔ TS)');
console.log('═══════════════════════════════════════════════════════════════');

const sqlGrants = {};
for (const role of roles) {
  const re = new RegExp(`where r\\.code = '${role}' and p\\.code in \\(([^)]+)\\)`, 's');
  const m = sql.match(re);
  if (m) sqlGrants[role] = m[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, '')).sort();
}

const tsGrants = {};
for (const role of roles) {
  const re = new RegExp(`${role}:\\s*\\[([\\s\\S]*?)\\]`);
  const m = ts.match(re);
  if (m) tsGrants[role] = m[1].match(/"([^"]+)"/g).map(s => s.replace(/"/g, '')).sort();
}

let grantsOk = true;
for (const role of roles) {
  const s = new Set(sqlGrants[role] || []);
  const t = new Set(tsGrants[role] || []);
  const sOnly = [...s].filter(p => !t.has(p));
  const tOnly = [...t].filter(p => !s.has(p));
  if (sOnly.length || tOnly.length) {
    grantsOk = false;
    console.log(`  ❌ ${role}:`);
    if (sOnly.length) console.log(`     SQL-only: ${sOnly.join(', ')}`);
    if (tOnly.length) console.log(`     TS-only: ${tOnly.join(', ')}`);
  }
}
if (grantsOk) console.log('  ✅ All 8 role grants IN SYNC');

// ─── 3. Route Config Permission Codes ───────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  AUDIT 3: Route Config Permission Codes');
console.log('═══════════════════════════════════════════════════════════════');

const routePerms = new Set();
for (const m of routeConfig.matchAll(/"([a-z][a-z0-9_]*\.[a-z0-9_.]+)"/g)) {
  routePerms.add(m[1]);
}

const routeOnly = [...routePerms].filter(p => !sqlPerms.has(p)).sort();
console.log(`  Route config references ${routePerms.size} unique permission codes`);
if (routeOnly.length) {
  console.log('  ❌ Permissions in route config not in SQL schema:');
  routeOnly.forEach(p => console.log(`     ${p}`));
} else {
  console.log('  ✅ All route config permissions exist in SQL schema');
}

// ─── 4. Mock RBAC ↔ TS Role Grants ──────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  AUDIT 4: Mock RBAC Role Resolution');
console.log('═══════════════════════════════════════════════════════════════');

const mockRoles = {};
const mockEmails = ['admin@company.com', 'sysadmin@company.com', 'hradmin@company.com', 'payroll@company.com',
  'manager.m1@company.com', 'employee.e1@company.com', 'statutory.admin@company.com',
  'finance.admin@company.com', 'it.admin@company.com', 'multi.hrmgr@company.com', 'hr.alt@company.com'];

// Extract resolveMockRolesFromEmail logic
const resolveSection = mockRbac.substring(mockRbac.indexOf('export function resolveMockRolesFromEmail'));
const mockEmailToRole = {};
for (const m of resolveSection.matchAll(/if \(email\.includes\("([^"]+)"\)\) return \{ roles: \["([^"]+)"\]/g)) {
  mockEmailToRole[m[1]] = m[2];
}
// Also handle multi-role
const multiMatch = resolveSection.match(/if \(email\.includes\("multi\.hrmgr"\)\) return \{ roles: \["([^"]+)", "([^"]+)"\]/);
if (multiMatch) mockEmailToRole['multi.hrmgr'] = [multiMatch[1], multiMatch[2]];

for (const email of mockEmails) {
  let resolvedRole = null;
  for (const [key, role] of Object.entries(mockEmailToRole)) {
    if (email.includes(key)) { resolvedRole = role; break; }
  }
  if (!resolvedRole) resolvedRole = 'employee';
  
  const roles = Array.isArray(resolvedRole) ? resolvedRole : [resolvedRole];
    console.log(`  ${email} → [${roles.join(', ')}]`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  AUDIT 5: combined_init.sql vs Modular Files');
console.log('═══════════════════════════════════════════════════════════════');

import { readdirSync, statSync } from 'fs';
const schemaFiles = readdirSync('schema')
  .filter(f => f.endsWith('.sql') && f !== 'combined_init.sql' && f !== 'mock_seed.sql' && !f.startsWith('bootstrap'))
  .sort();

let totalBytes = 0;
for (const f of schemaFiles) {
  totalBytes += statSync(`schema/${f}`).size;
}
const combinedSize = statSync('schema/combined_init.sql').size;
console.log(`  ${schemaFiles.length} modular files → ${totalBytes} bytes`);
console.log(`  combined_init.sql → ${combinedSize} bytes`);
console.log(`  Ratio: ${(combinedSize / totalBytes * 100).toFixed(1)}% (headers + concatenation overhead expected)`);
console.log('  ✅ Run `npm run db:sync` to regenerate if any modular file changed');
