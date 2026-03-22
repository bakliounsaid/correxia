/**
 * Crée un compte Auth Supabase « admin plateforme » (mot de passe hashé côté Supabase).
 *
 * Prérequis : exécuter supabase/migrations/003_platform_admin.sql sur le projet.
 *
 * Usage (PowerShell, à la racine du repo) :
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..."
 *   $env:PLATFORM_ADMIN_PASSWORD="votre_mot_de_passe"
 *   node scripts/create-platform-admin.mjs
 *
 * L’URL est lue depuis .env.local (NEXT_PUBLIC_SUPABASE_URL) si vous ne l’exportez pas.
 * Remplacez les exemples du type https://votre-projet.supabase.co par l’URL réelle du dashboard.
 *
 * Optionnel : PLATFORM_ADMIN_EMAIL (défaut admin@gmail.com)
 *
 * Clé service_role : Dashboard Supabase → Project Settings → API (ne jamais la committer ni la préfixer NEXT_PUBLIC_).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** Charge .env.local / .env à la racine (sans dépendance dotenv). */
function loadRootEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(repoRoot, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && val && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

loadRootEnvFiles();

function isPlaceholderSupabaseUrl(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (!host.endsWith(".supabase.co")) return false;
    const sub = host.replace(".supabase.co", "");
    const bad =
      sub.includes("votre-projet") ||
      sub.includes("votre_projet") ||
      sub === "xxx" ||
      sub.startsWith("xxxxxxxx") ||
      sub === "example" ||
      sub === "your-project";
    return bad;
  } catch {
    return true;
  }
}

const url =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const email =
  process.env.PLATFORM_ADMIN_EMAIL?.trim() || "admin@gmail.com";
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "";

if (!url || !serviceKey || !password) {
  console.error(
    "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL (dans .env.local ou l’environnement), SUPABASE_SERVICE_ROLE_KEY, PLATFORM_ADMIN_PASSWORD",
  );
  process.exit(1);
}

if (isPlaceholderSupabaseUrl(url)) {
  console.error(
    [
      "L’URL Supabase est encore un exemple (DNS introuvable).",
      `Valeur actuelle : ${url}`,
      "Ouvrez Supabase → Project Settings → API, copiez la « Project URL » (ex. https://abcdxyzefghij.supabase.co).",
      "Mettez-la dans .env.local : NEXT_PUBLIC_SUPABASE_URL=... puis relancez le script.",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    account_type: "platform_admin",
    first_name: "Admin",
    last_name: "Plateforme",
  },
});

if (error) {
  console.error("Erreur Supabase Auth :", error.message);
  process.exit(1);
}

console.log("Compte admin créé :", data.user?.email, "id =", data.user?.id);
console.log("Connexion sur /login puis accès /admin");
