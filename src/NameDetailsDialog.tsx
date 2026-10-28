import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import CategoryLabels from "./CategoryLabels";
import { numerology, type NameRecord, type Search } from "./domain";
import NameDetails from "./NameDetails";

type Props = {
  name: NameRecord;
  search: Search;
  showStatistics: boolean;
  onClose: () => void;
  onFindSimilar: () => void;
};

export default function NameDetailsDialog({
  name,
  search,
  showStatistics,
  onClose,
  onFindSimilar,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const number = numerology(name.name);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="name-dialog"
      aria-labelledby="name-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="name-dialog-header">
        <button
          className="text-link name-dialog-back"
          onClick={onClose}
          autoFocus
        >
          <ChevronRight size={18} /> חזרה לרשימה
        </button>
        <span className="kicker">קצת על השם</span>
        <h2 id="name-dialog-title">{name.name}</h2>
        {(search.firstName || search.surname) && (
          <p className="fullname">
            {[search.firstName, name.name, search.surname]
              .filter(Boolean)
              .join(" ")}
          </p>
        )}
        <CategoryLabels tags={name.tags} />
        {number !== null && (
          <p className="name-dialog-number">מספר נומרולוגי: {number}</p>
        )}
        <button className="outline-button similar-trigger" onClick={onFindSimilar}>
          עוד שמות בסגנון הזה ✦
        </button>
      </div>
      <NameDetails name={name} showStatistics={showStatistics} />
    </dialog>
  );
}
