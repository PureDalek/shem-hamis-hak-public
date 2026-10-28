import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  catalogSource,
  initialState,
  installPublishedContent,
  type AppState,
  type NameRecord,
  type Settings,
} from "./domain";
import { parseBackup } from "./storage";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
let client: SupabaseClient | null = null;
try {
  if (url && key) client = createClient(url, key);
} catch {
  // The local app remains usable if cloud configuration is malformed.
}
export const cloud = client;

type Published = {
  revision: number;
  catalog: { source: string; names: NameRecord[] };
  settings: Settings;
};
export function validatePublished(input: unknown): Published {
  if (!input || typeof input !== "object")
    throw new Error("Invalid published content");
  const row = input as Published;
  if (
    !Number.isInteger(row.revision) ||
    row.revision < 1 ||
    !row.catalog ||
    !Array.isArray(row.catalog.names) ||
    row.catalog.names.length < 1 ||
    row.catalog.names.length > 100000 ||
    !row.settings
  )
    throw new Error("Invalid published content");
  const ids = new Set<string>();
  for (const name of row.catalog.names) {
    if (
      !name ||
      typeof name.id !== "string" ||
      !name.id ||
      ids.has(name.id) ||
      typeof name.name !== "string" ||
      !name.name.trim() ||
      name.name.length > 80 ||
      (name.meaning !== undefined && typeof name.meaning !== "string") ||
      (name.origin !== undefined && typeof name.origin !== "string") ||
      (name.hidden !== undefined && typeof name.hidden !== "boolean") ||
      !Array.isArray(name.genders) ||
      !name.genders.every((g) => g === "boy" || g === "girl") ||
      !Array.isArray(name.observations) ||
      !name.observations.every(
        (o) =>
          o &&
          typeof o.group === "string" &&
          typeof o.gender === "string" &&
          typeof o.count === "number" &&
          Number.isFinite(o.count) &&
          o.count >= 0 &&
          typeof o.year === "number",
      )
    )
      throw new Error("Invalid catalog entry");
    ids.add(name.id);
  }
  const safeSettings = parseBackup(
    JSON.stringify({ ...initialState(), settings: row.settings }),
  ).settings;
  const source =
    typeof row.catalog.source === "string" &&
    row.catalog.source.startsWith("https://")
      ? row.catalog.source
      : catalogSource;
  return {
    revision: row.revision,
    catalog: { source, names: row.catalog.names },
    settings: safeSettings,
  };
}

export async function loadPublishedContent() {
  if (!cloud) return;
  try {
    const request = cloud
      .from("site_content")
      .select("revision,catalog,settings")
      .eq("id", 1)
      .maybeSingle();
    const result = await Promise.race([
      request,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!result || result.error || !result.data) return;
    const row = validatePublished(result.data);
    installPublishedContent(
      row.catalog.names,
      row.catalog.source,
      row.settings,
      row.revision,
    );
  } catch {
    // Fall back to the bundled catalog when offline or before first publication.
  }
}

async function currentUserId(): Promise<string> {
  if (!cloud) throw new Error("Cloud unavailable");
  const { data, error } = await cloud.auth.getUser();
  if (error || !data.user) throw new Error("Sign-in required");
  return data.user.id;
}
export async function saveCloudBackup(state: AppState) {
  if (!cloud) throw new Error("Cloud unavailable");
  const userId = await currentUserId();
  const { error } = await cloud.from("user_backups").upsert({
    user_id: userId,
    payload: state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
export async function readCloudBackup(): Promise<AppState | null> {
  if (!cloud) throw new Error("Cloud unavailable");
  const userId = await currentUserId();
  const { data, error } = await cloud
    .from("user_backups")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? parseBackup(JSON.stringify(data.payload)) : null;
}
export async function deleteCloudBackup() {
  if (!cloud) throw new Error("Cloud unavailable");
  const userId = await currentUserId();
  const { error } = await cloud
    .from("user_backups")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
