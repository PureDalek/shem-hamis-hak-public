import {
  catalogSource,
  isSafeHttpsUrl,
  summarizeObservations,
  type NameRecord,
} from "./domain";

type Props = { name: NameRecord; showStatistics: boolean };

export default function NameDetails({ name, showStatistics }: Props) {
  const statistics = summarizeObservations(name.observations);

  return (
    <div className="name-details">
      {name.meaning ? (
        <p>
          <strong>פירוש אפשרי: </strong>
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
      {name.meaningSource && isSafeHttpsUrl(name.meaningSource) && (
        <p>
          <a href={name.meaningSource} target="_blank" rel="noreferrer">
            מקור לפירוש השם ↗
          </a>
        </p>
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
