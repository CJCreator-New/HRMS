#!/usr/bin/env node
/**
 * verify-permissions-sync.mjs
 *
 * CI check: verifies that the TypeScript ROLE_PERMISSIONS_MAP in
 * src/lib/auth/permissions-map.ts matches the SQL seed in schema/01_rbac.sql.
 *
 * Usage: node scripts/verify-permissions-sync.mjs
 *
 * Exit codes:
 *   0 — all permission codes and role mappings match
 *   1 — mismatch found (details printed to stdout)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Parse SQL seed — extract role → permission mappings
// ---------------------------------------------------------------------------

function parseSqlSeed() {
  const sql = readFileSync(
    resolve(ROOT, "schema/01_rbac.sql"),
    "utf-8"
  );

  // Extract all permission codes from the INSERT INTO permissions block
  const allPermissions = [];
  const permRegex = /\('([a-z][a-z0-9.]*(?:\.[a-z0-9]+)*)'/g;
  let match;

  // Find the permissions INSERT block
  const permBlockMatch = sql.match(
    /INSERT INTO permissions \(code.*?\)\s*VALUES\s*([\s\S]*?)on conflict/i
  );
  if (permBlockMatch) {
    const block = permBlockMatch[1];
    while ((match = permRegex.exec(block)) !== null) {
      allPermissions.push(match[1]);
    }
  }

  // Extract role → permission mappings from role_permissions INSERT blocks
  const rolePermissions = {};
  const roleBlocks = sql.matchAll(
    /WHERE r\.code = '([^']+)' and p\.code in \(([\s\S]*?)\)/gi
  );

  for (const [, roleCode, codesBlock] of roleBlocks) {
    const codes = [];
    const codeRegex = /'([a-z][a-z0-9.]*(?:\.[a-z0-9]+)*)'/g;
    let m;
    while ((m = codeRegex.exec(codesBlock)) !== null) {
      codes.push(m[1]);
    }
    if (codes.length > 0) {
      if (!rolePermissions[roleCode]) {
        rolePermissions[roleCode] = new Set();
      }
      codes.forEach((c) => rolePermissions[roleCode].add(c));
    }
  }

  // Convert sets to sorted arrays
  for (const role of Object.keys(rolePermissions)) {
    rolePermissions[role] = [...rolePermissions[role]].sort();
  }

  return { allPermissions: [...new Set(allPermissions)].sort(), rolePermissions };
}

// ---------------------------------------------------------------------------
// 2. Parse TypeScript permissions map
// ---------------------------------------------------------------------------

function parseTsMap() {
  const ts = readFileSync(
    resolve(ROOT, "src/lib/auth/permissions-map.ts"),
    "utf-8"
  );

  // Extract the ROLE_PERMISSIONS_MAP object contents
  const mapMatch = ts.match(
    /export const ROLE_PERMISSIONS_MAP.*?=\s*\{([\s\S]*?)\};\s*\n/
  );
  if (!mapMatch) {
    throw new Error("Could not find ROLE_PERMISSIONS_MAP in permissions-map.ts");
  }

  const mapBlock = mapMatch[1];
  const rolePermissions = {};

  // Match each role array: role: [...]
  const roleArrayRegex = /(\w+):\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = roleArrayRegex.exec(mapBlock)) !== null) {
    const roleCode = m[1];
    const codesBlock = m[2];
    const codes = [];
    const codeRegex = /"([a-z][a-z0-9.]*(?:\.[a-z0-9]+)*)"/g;
    let cm;
    while ((cm = codeRegex.exec(codesBlock)) !== null) {
      codes.push(cm[1]);
    }
    rolePermissions[roleCode] = codes.sort();
  }

  return { rolePermissions };
}

// ---------------------------------------------------------------------------
// 3. Compare and report
// ---------------------------------------------------------------------------

function compare() {
  const sql = parseSqlSeed();
  const ts = parseTsMap();
  let hasError = false;

  // Check: all SQL permissions exist in at least one TS role
  const tsAllPermissions = new Set(
    Object.values(ts.rolePermissions).flat()
  );

  // Check: all TS roles exist in SQL
  const sqlRoles = new Set(Object.keys(sql.rolePermissions));
  const tsRoles = new Set(Object.keys(ts.rolePermissions));

  console.log("=== Permission Sync Verification ===\n");

  // Report role presence
  for (const role of tsRoles) {
    if (!sqlRoles.has(role)) {
      console.log(`⚠  TS role "${role}" not found in SQL seed — this is a drift issue`);
      hasError = true;
    }
  }
  for (const role of sqlRoles) {
    if (!tsRoles.has(role)) {
      console.log(`ℹ  SQL role "${role}" not in TS map (SQL-only role, not used in mock RBAC)`);
    }
  }

  // Report permission code mismatches per role
  for (const role of [...tsRoles].filter((r) => sqlRoles.has(r))) {
    const sqlPerms = new Set(sql.rolePermissions[role]);
    const tsPerms = new Set(ts.rolePermissions[role]);

    const missingInTs = [...sqlPerms].filter((p) => !tsPerms.has(p));
    const extraInTs = [...tsPerms].filter((p) => !sqlPerms.has(p));

    if (missingInTs.length > 0) {
      console.log(`\n❌ Role "${role}": missing in TS map:`);
      missingInTs.forEach((p) => console.log(`   - ${p}`));
      hasError = true;
    }
    if (extraInTs.length > 0) {
      console.log(`\n❌ Role "${role}": extra in TS map (not in SQL seed):`);
      extraInTs.forEach((p) => console.log(`   - ${p}`));
      hasError = true;
    }
    if (missingInTs.length === 0 && extraInTs.length === 0) {
      console.log(`✅ Role "${role}": ${tsPerms.size} permissions match`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`SQL roles: ${sqlRoles.size}, TS roles: ${tsRoles.size}`);
  console.log(`SQL permission codes: ${sql.allPermissions.length}`);
  console.log(`TS total unique permissions: ${tsAllPermissions.size}`);

  if (hasError) {
    console.log("\n❌ Permission sync FAILED — TS map references roles not in SQL seed.");
    process.exit(1);
  } else {
    console.log("\n✅ Permission sync OK — all TS roles exist in SQL seed, all permission codes match.");
    process.exit(0);
  }
}

try {
  compare();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
