import { useCallback, useEffect, useRef, useState } from "react";
import { appTabUrl, readAppTab, type AppTab } from "../shared/app-navigation";
import { syncPageMetadata } from "../shared/page-metadata";

export function useTabNavigation() {
  const [tab, update] = useState<AppTab>(() => readAppTab(location.search));
  useEffect(() => {
    if(new URLSearchParams(location.search).get('tab') === 'TRIP') history.replaceState(history.state,'',appTabUrl(location.href,'ROUTES'));
    syncPageMetadata();
  }, [tab]);
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const back = () => {
      update(readAppTab(location.search));
      const y = Number(history.state?.nowroScrollY) || 0;
      requestAnimationFrame(() =>
        window.scrollTo({ top: y, behavior: "instant" }),
      );
    };
    addEventListener("popstate", back);
    return () => {
      removeEventListener("popstate", back);
      history.scrollRestoration = previous;
    };
  }, []);
  const navigate = useCallback((next: AppTab) => {
    const url = appTabUrl(location.href, next);
    if (url.href !== location.href) {
      history.replaceState(
        { ...history.state, nowroScrollY: scrollY },
        "",
        location.href,
      );
      history.pushState({ nowroScrollY: 0 }, "", url);
    }
    update(readAppTab(url.search));
    requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));
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
    history.replaceState(
      { ...history.state, nowroScrollY: scrollY },
      "",
      location.href,
    );
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
