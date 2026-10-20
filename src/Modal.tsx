import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useBackDismiss } from "./AppNavigation";

export function Modal({
  title,
  close,
  children,
  historyQuery,
  closeDisabled = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  historyQuery?: { key: string; value: string };
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const current = useRef({ close, closeDisabled });
  current.current = { close, closeDisabled };
  const dismiss = () => {
    if (!current.current.closeDisabled) current.current.close();
  };
  useBackDismiss(dismiss, historyQuery);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      if (!elements.length) {
        event.preventDefault();
        ref.current?.focus();
        return;
      }
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="overlay" onClick={dismiss}>
      <div
        className="modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-btn"
            onClick={dismiss}
            disabled={closeDisabled}
            aria-label="Close / 닫기"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
