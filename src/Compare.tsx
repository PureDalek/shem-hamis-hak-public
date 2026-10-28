import { useRef, useState } from "react";
import { Download, Upload, UsersRound } from "lucide-react";
import { compareShortlists } from "./domain";
import { downloadJson } from "./storage";

type Props = { names: string[] };
export default function Compare({ names }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [partnerNames, setPartnerNames] = useState<string[] | null>(null);
  const result = partnerNames ? compareShortlists(names, partnerNames) : null;
  const [error, setError] = useState("");
  const compare = async (file: File) => {
    try {
      if (file.size > 100_000) throw new Error("File too large");
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== "object") throw new Error("Invalid file");
      const list = data as {
        type?: unknown;
        version?: unknown;
        names?: unknown;
      };
      if (
        list.type !== "shem-hamis-hak-shortlist" ||
        list.version !== 1 ||
        !Array.isArray(list.names) ||
        list.names.length > 3000 ||
        !list.names.every(
          (name) => typeof name === "string" && name.length <= 80,
        )
      )
        throw new Error("Invalid list");
      setPartnerNames(list.names);
      setError("");
    } catch {
      setPartnerNames(null);
      setError("לא הצלחנו לקרוא את הרשימה. ודאו שזה קובץ רשימה של שם המשחק.");
    }
  };
  return (
    <div className="compare-panel">
      <button
        className="compare-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>
          <UsersRound size={18} /> השוואה עם בן או בת הזוג
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="compare-content">
          <p>
            כל אחד שומר רשימה במכשיר שלו. שתפו ביניכם קובץ רשימה, ואז טענו אותו
            כאן כדי לגלות אילו שמות אהבתם יחד.
          </p>
          <p>הקובץ מכיל רק את השמות ששמרתם. הוא לא נשלח אוטומטית לאף אחד.</p>
          <button
            className="outline-button"
            disabled={!names.length}
            onClick={() =>
              downloadJson("our-names.json", {
                type: "shem-hamis-hak-shortlist",
                version: 1,
                names,
              })
            }
          >
            <Download size={17} /> הורדת הרשימה שלי
          </button>
          <button
            className="outline-button"
            disabled={!names.length}
            onClick={() => input.current?.click()}
          >
            <Upload size={17} /> בחירת הרשימה שלהם
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await compare(file);
              e.target.value = "";
            }}
          />
          {error && (
            <p role="alert" className="compare-error">
              {error}
            </p>
          )}
          {result && (
            <div className="compare-result" role="status">
              <strong>
                {result.length === 1
                  ? "יש לכם שם משותף אחד!"
                  : result.length > 1
                    ? `יש לכם ${result.length} שמות משותפים!`
                    : "עוד אין שמות משותפים ברשימות האלה"}
              </strong>
              {result.length > 0 && (
                <div className="chips">
                  {result.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
