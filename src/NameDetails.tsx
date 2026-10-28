import {
  catalogSource,
  meaningReferences,
  meaningStatusLabels,
  summarizeObservations,
  type NameRecord,
} from "./domain";

type Props = { name: NameRecord; showStatistics: boolean };

export default function NameDetails({ name, showStatistics }: Props) {
  const statistics = summarizeObservations(name.observations);
  const references = meaningReferences(name);

  return (
    <div className="name-details">
      {name.meaning ? (
        <p>
          <strong>{meaningStatusLabels[name.meaningStatus ?? "possible"]}: </strong>
          {name.meaning}
        </p>
      ) : (
        <p>
          עדיין אין לשם הזה פירוש שנבדק. אפשר{" "}
          <a
            href={`https://he.wiktionary.org/w/index.php?search=${encodeURIComponent(name.name)}`}
            target="_blank"
            rel="noreferrer"
          >
            לחפש בוויקימילון ↗
          </a>
        </p>
      )}
      {name.origin && (
        <p>
          <strong>מקור אפשרי: </strong>
          {name.origin}
        </p>
      )}
      {name.meaning && (
        <div className="meaning-evidence">
          {name.meaningNote && <p>{name.meaningNote}</p>}
          <strong>{references.length === 1 ? "סימוכין אחד" : `${references.length} סימוכין`}</strong>
          {references.length > 0 ? <>
            <ul>{references.map(ref => <li key={ref.url}>
              <a href={ref.url} target="_blank" rel="noreferrer">{ref.label} ↗</a>
              {ref.note && <span> — {ref.note}</span>}
            </li>)}</ul>
            <p className="evidence-caveat">הספירה היא של ערכי מקור מקושרים; היא אינה ציון ודאות או מספר אימותים עצמאיים.</p>
            {references.some(ref => new URL(ref.url).hostname.endsWith('.wiktionary.org')) &&
              <p className="evidence-caveat">הניסוח הוא עיבוד עברי של מקורות ובהם תורמי ויקימילון, ברישיון <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.</p>}
          </> : <p>עדיין לא צורף מקור לפירוש הזה.</p>}
        </div>
      )}
      {showStatistics &&
        (name.observations.length > 0 ? (
          <>
            <p>
              <strong>ילידי 2020–2024 לפי השם הנוכחי, בנתונים שפורסמו:</strong>
            </p>
            {statistics.leadingGroup && (
              <p>
                <strong>
                  בנתונים שפורסמו, השם נפוץ בעיקר אצל {statistics.leadingGroup}.
                </strong>
              </p>
            )}
            <div className="statistics-list">
              {statistics.rows.map((row) => (
                <div
                  className="statistics-row"
                  key={`${row.year}-${row.group}`}
                >
                  <strong>
                    {row.year} · {row.group}
                  </strong>
                  <span>
                    בנים:{" "}
                    {row.boy === undefined
                      ? "לא פורסם"
                      : row.boy.toLocaleString("he-IL")}{" "}
                    · בנות:{" "}
                    {row.girl === undefined
                      ? "לא פורסם"
                      : row.girl.toLocaleString("he-IL")}
                  </span>
                </div>
              ))}
            </div>
            <p>
              * הסכום כולל רק נתונים שפורסמו לקבוצות הזמינות, ואינו מספר מלא
              לכלל האוכלוסייה. נתונים חסרים אינם אפס.
            </p>
            <a href={catalogSource} target="_blank" rel="noreferrer">
              מקור: הלשכה המרכזית לסטטיסטיקה ↗
            </a>
          </>
        ) : (
          <p>אין נתונים סטטיסטיים זמינים לשם הזה במאגר.</p>
        ))}
    </div>
  );
}
