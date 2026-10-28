import { useMemo, useState } from "react";
import { Heart, X } from "lucide-react";
import { categories } from "./categories";
import {
  similarNames,
  type AppState,
  type NameRecord,
  type Search,
} from "./domain";

type Props = {
  state: AppState;
  search: Search;
  reference: NameRecord;
  onClose: () => void;
  onDetails: (id: string) => void;
  onSave: (id: string) => void;
};

export default function SimilarNames({
  state,
  search,
  reference,
  onClose,
  onDetails,
  onSave,
}: Props) {
  const [options, setOptions] = useState({
    length: true,
    topics: true,
    letters: false,
  });
  const [limit, setLimit] = useState(8);
  const matches = useMemo(
    () => similarNames(state, search, reference, options),
    [state, search, reference, options],
  );
  const topicsAvailable = (reference.tags ?? []).some(
    (tag) =>
      tag !== "unclassified" &&
      categories.some((category) => category.id === tag),
  );
  return (
    <section className="similar-panel" aria-labelledby="similar-title">
      <div className="similar-heading">
        <div>
          <span className="kicker">מגלים עוד</span>
          <h3 id="similar-title" tabIndex={-1}>עוד שמות בסגנון {reference.name}</h3>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="סגירת המלצות"
        >
          <X size={18} />
        </button>
      </div>
      <p>
        מה אהבתם בשם? ההצעות מתאימות לפחות לאחת מהבחירות ולסינון החיפוש הנוכחי.
      </p>
      <fieldset className="similar-options">
        <legend>מה חשוב לכם בדמיון?</legend>
        <label>
          <input
            type="checkbox"
            checked={options.length}
            onChange={(e) =>
              setOptions({ ...options, length: e.target.checked })
            }
          />{" "}
          אותו מספר אותיות
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.topics && topicsAvailable}
            disabled={!topicsAvailable}
            onChange={(e) =>
              setOptions({ ...options, topics: e.target.checked })
            }
          />{" "}
          נושאים משותפים
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.letters}
            onChange={(e) =>
              setOptions({ ...options, letters: e.target.checked })
            }
          />{" "}
          אותיות משותפות
        </label>
      </fieldset>
      {!topicsAvailable && <p>לשם הזה אין נושא זמין להשוואה.</p>}
      {options.letters && <p>אותיות משותפות אינן מבטיחות צליל דומה.</p>}
      {!options.length &&
      !options.letters &&
      !(options.topics && topicsAvailable) ? (
        <p>בחרו לפחות מאפיין אחד כדי לראות הצעות.</p>
      ) : matches.length === 0 ? (
        <p>
          לא מצאנו שמות חדשים שמתאימים לבחירות ולסינון החיפוש. אפשר לשנות אותם
          ולנסות שוב.
        </p>
      ) : (
        <>
          <div className="similar-results">
            {matches
              .slice(0, limit)
              .map(({ name, topics, sameLength, letters }) => {
                const reasons = [
                  ...topics
                    .map(
                      (id) =>
                        categories.find((category) => category.id === id)
                          ?.label,
                    )
                    .filter(Boolean),
                  ...(sameLength ? ["אותו מספר אותיות"] : []),
                  ...(letters.length
                    ? [`אותיות משותפות: ${letters.join("׳ ")}`]
                    : []),
                ];
                return (
                  <div className="similar-result" key={name.id}>
                    <button
                      className="similar-name"
                      onClick={() => onDetails(name.id)}
                      aria-haspopup="dialog"
                    >
                      <strong>{name.name}</strong>
                      <small>{reasons.join(" · ")}</small>
                    </button>
                    <button
                      className="list-action"
                      onClick={() => onSave(name.id)}
                      aria-label={`שמירת ${name.name}`}
                    >
                      <Heart size={18} />
                    </button>
                  </div>
                );
              })}
          </div>
          {matches.length > limit && (
            <button
              className="text-link similar-more"
              onClick={() => setLimit(limit + 8)}
            >
              הצגת שמות נוספים
            </button>
          )}
        </>
      )}
    </section>
  );
}
