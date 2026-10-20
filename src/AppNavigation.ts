import { useCallback, useEffect, useRef, useState } from "react";
import { appTabUrl, readAppTab, type AppTab } from "../shared/app-navigation";

export function useTabNavigation() {
  const [tab, update] = useState<AppTab>(() => readAppTab(location.search));
  useEffect(() => {
    const back = () => update(readAppTab(location.search));
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  const navigate = useCallback((next: AppTab) => {
    const url = appTabUrl(location.href, next);
    if (url.href !== location.href) history.pushState(null, "", url);
    update(next);
  }, []);
  return [tab, navigate] as const;
}

// Give Android/browser Back one history entry per dialog, including nested dialogs.
export function useBackDismiss(
  close: () => void,
  query?: { key: string; value: string },
) {
  const current = useRef(close);
  current.current = close;
  useEffect(() => {
    const marker = crypto.randomUUID();
    const dialogUrl = new URL(location.href);
    if (query) {
      const base = new URL(location.href);
      base.searchParams.delete(query.key);
      history.replaceState(history.state, "", base);
      dialogUrl.searchParams.set(query.key, query.value);
    }
    history.pushState({ ...history.state, nowroDialog: marker }, "", dialogUrl);
    const back = () => {
      if (history.state?.nowroDialog !== marker) current.current();
    };
    addEventListener("popstate", back);
    return () => {
      removeEventListener("popstate", back);
      if (history.state?.nowroDialog === marker) history.back();
    };
  }, []);
}
