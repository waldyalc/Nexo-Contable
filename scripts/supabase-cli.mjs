import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Ejecuta la Supabase CLI aislada para Nexo Contable cargando
 * SUPABASE_ACCESS_TOKEN desde .env.local, sin cerrar sesión ni tocar
 * la cuenta global de Supabase CLI configurada en la PC del usuario.
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = path.resolve(import.meta.dirname, "..");
const localEnv = loadEnvFile(path.join(root, ".env.local"));
const env = { ...process.env, ...localEnv };

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.warn(
    "[supabase-cli] Aviso: SUPABASE_ACCESS_TOKEN no está definido en .env.local. " +
      "Agrégalo en .env.local para aislar la cuenta de Nexo Contable sin tocar tu cuenta global.",
  );
}

const bin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const res = spawnSync(bin, ["exec", "supabase", ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: "inherit",
});

process.exit(res.status ?? 1);
