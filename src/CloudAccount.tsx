import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { Cloud, Download, LogOut, Trash2, Upload } from "lucide-react";
import {
  cloud,
  deleteCloudBackup,
  readCloudBackup,
  saveCloudBackup,
} from "./cloud";
import type { AppState } from "./domain";
import { reconcilePublishedSettings } from "./storage";

type Props = { state: AppState; setState: Dispatch<SetStateAction<AppState>> };
export default function CloudAccount({ state, setState }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    void cloud.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const client = cloud;
  if (!client) return null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage("הפעולה לא הצליחה. בדקו את החיבור ונסו שוב.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cloud-account">
      <h3>
        <Cloud size={19} /> גיבוי לחשבון
      </h3>
      {!user ? (
        <>
          <p>התחברו כדי לשמור גיבוי של החיפושים ולהעביר אותם למכשיר אחר.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const { error } = await client.auth.signInWithOtp({
                  email: email.trim(),
                  options: {
                    emailRedirectTo:
                      window.location.origin + window.location.pathname,
                  },
                });
                if (error) throw error;
                setMessage("שלחנו קישור התחברות. בדקו את תיבת הדואר שלכם.");
              });
            }}
          >
            <label htmlFor="cloud-email">כתובת אימייל</label>
            <input
              id="cloud-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
            />
            <button disabled={busy} className="outline-button">
              שליחת קישור התחברות
            </button>
          </form>
        </>
      ) : (
        <>
          <p>
            מחוברים כ־<bdi>{user.email}</bdi>. הגיבוי מתבצע רק כשתבחרו לשמור
            אותו.
          </p>
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => {
              if (
                !confirm("להחליף את הגיבוי הקיים בחשבון בנתונים מהמכשיר הזה?")
              )
                return;
              void run(async () => {
                await saveCloudBackup(state);
                setMessage("הגיבוי נשמר בחשבון.");
              });
            }}
          >
            <Upload size={17} /> שמירה לחשבון
          </button>
          <button
            className="outline-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const backup = await readCloudBackup();
                if (!backup) {
                  setMessage("עדיין אין גיבוי בחשבון.");
                  return;
                }
                if (
                  confirm("שחזור הגיבוי יחליף את הנתונים במכשיר הזה. להמשיך?")
                ) {
                  setState(reconcilePublishedSettings(backup));
                  setMessage("הגיבוי שוחזר למכשיר.");
                }
              })
            }
          >
            <Download size={17} /> שחזור מהחשבון
          </button>
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => {
              if (!confirm("למחוק את הגיבוי שבחשבון? הנתונים במכשיר יישארו."))
                return;
              void run(async () => {
                await deleteCloudBackup();
                setMessage("הגיבוי בחשבון נמחק.");
              });
            }}
          >
            <Trash2 size={17} /> מחיקת הגיבוי מהחשבון
          </button>
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => {
              if (
                !confirm(
                  "למחוק לצמיתות את החשבון ואת הגיבוי בענן? הנתונים במכשיר יישארו. חשבון המנהל האחרון אינו ניתן למחיקה לפני מינוי מנהל נוסף.",
                )
              )
                return;
              void run(async () => {
                const { error } = await client.rpc("delete_own_account");
                if (error?.code === "42501") {
                  setMessage(
                    "אם זה חשבון המנהל האחרון, יש למנות מנהל נוסף לפני מחיקתו.",
                  );
                  return;
                }
                if (error) throw error;
                // The database deletion is already committed; a sign-out error must not be reported as deletion failure.
                try {
                  await client.auth.signOut({ scope: "local" });
                } catch {
                  /* session will expire */
                }
                setUser(null);
                setMessage("החשבון והגיבוי בענן נמחקו. הנתונים במכשיר נשארו.");
              });
            }}
          >
            <Trash2 size={17} /> מחיקת החשבון
          </button>
          <button
            className="text-link cloud-signout"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { error } = await client.auth.signOut();
                if (error) throw error;
                setMessage("התנתקתם מהחשבון.");
              })
            }
          >
            <LogOut size={15} /> התנתקות
          </button>
        </>
      )}
      {message && (
        <p role="status" className="cloud-message">
          {message}
        </p>
      )}
    </div>
  );
}
