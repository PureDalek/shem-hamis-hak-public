import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { CloudUpload, History } from "lucide-react";
import { cloud, validatePublished } from "./cloud";
import {
  allNames,
  catalogSource,
  installPublishedContent,
  type AppState,
} from "./domain";

type Props = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  canPublish: boolean;
};
type Revision = { revision: number; created_at: string };
export default function CloudAdmin({ state, setState, canPublish }: Props) {
  const [admin, setAdmin] = useState(false);
  const [revision, setRevision] = useState<number | null>(null);
  const [history, setHistory] = useState<Revision[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const client = cloud;
    if (!client) return;
    let active = true;
    const check = async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) {
        if (active) setAdmin(false);
        return;
      }
      const { data: allowed, error } = await client.rpc("is_site_admin");
      if (!active) return;
      setAdmin(!error && allowed === true);
      if (!error && allowed === true) {
        const [current, revisions] = await Promise.all([
          client
            .from("site_content")
            .select("revision")
            .eq("id", 1)
            .maybeSingle(),
          client
            .from("content_revisions")
            .select("revision,created_at")
            .order("revision", { ascending: false })
            .limit(8),
        ]);
        if (!active) return;
        if (!current.error) setRevision(current.data?.revision ?? 0);
        if (!revisions.error) setHistory(revisions.data ?? []);
      }
    };
    void check();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      queueMicrotask(() => void check());
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const client = cloud;
  if (!client || !admin) return null;
  const publish = async (
    catalog: unknown,
    settings: unknown,
    restore = false,
  ) => {
    if (revision === null) {
      setMessage("לא ניתן לקרוא את גרסת האתר. נסו לרענן.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const valid = validatePublished({ revision: 1, catalog, settings });
      const { data, error } = await client.rpc("publish_site", {
        p_catalog: valid.catalog,
        p_settings: valid.settings,
        p_expected_revision: revision,
      });
      if (error || typeof data !== "number")
        throw error ?? new Error("Invalid revision");
      installPublishedContent(
        valid.catalog.names,
        valid.catalog.source,
        valid.settings,
        data,
      );
      setState((prev) => ({
        ...prev,
        siteRevision: data,
        settings: valid.settings,
        ...(restore ? { overrides: {}, extraCatalog: [] } : {}),
      }));
      setRevision(data);
      setMessage(`גרסה ${data} פורסמה. היא תופיע בכניסה הבאה לאתר.`);
      // Publication has succeeded even if refreshing the history later fails.
      try {
        const { data: revisions } = await client
          .from("content_revisions")
          .select("revision,created_at")
          .order("revision", { ascending: false })
          .limit(8);
        if (revisions) setHistory(revisions);
      } catch {
        /* the published revision is already confirmed */
      }
    } catch {
      setMessage(
        "הפרסום לא הצליח. ייתכן שהמאגר השתנה מאז הפתיחה; רעננו ובדקו את הנתונים.",
      );
    } finally {
      setBusy(false);
    }
  };
  const restore = async (selected: number) => {
    if (
      !confirm(
        `לשחזר את גרסה ${selected}? תיווצר גרסה חדשה והטיוטה המקומית תוחלף.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client
        .from("content_revisions")
        .select("catalog,settings")
        .eq("revision", selected)
        .maybeSingle();
      if (error || !data) throw error ?? new Error("Revision not found");
      setBusy(false);
      await publish(data.catalog, data.settings, true);
    } catch {
      setBusy(false);
      setMessage("לא ניתן לקרוא את הגרסה המבוקשת.");
    }
  };
  return (
    <div className="cloud-admin">
      <h3>
        <CloudUpload size={19} /> פרסום לכל המשתמשים
      </h3>
      <p>
        המאגר וההגדרות המקומיים יפורסמו כגרסה חדשה. חיפושים ונתונים אישיים אינם
        מתפרסמים.
      </p>
      <button
        className="primary-button"
        disabled={busy || revision === null || !canPublish}
        onClick={() => {
          if (confirm("לפרסם את המאגר וההגדרות לכל המשתמשים?"))
            void publish(
              { source: catalogSource, year: 2024, names: allNames(state) },
              state.settings,
            );
        }}
      >
        פרסום גרסה {revision === null ? "" : revision + 1}
      </button>
      {history.length > 0 && (
        <>
          <h4>
            <History size={16} /> גרסאות אחרונות
          </h4>
          <div className="revision-list">
            {history.map((item) => (
              <button
                key={item.revision}
                disabled={busy}
                onClick={() => void restore(item.revision)}
              >
                גרסה {item.revision} ·{" "}
                {new Date(item.created_at).toLocaleDateString("he-IL")}{" "}
                <span>שחזור</span>
              </button>
            ))}
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
