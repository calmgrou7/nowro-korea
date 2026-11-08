import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { analyticsPage, disableAnalytics, enableAnalytics } from "./analytics";
import { privatePage } from "../shared/attribution";
export function Analytics({
  consent,
  tab,
  lang,
}: {
  consent: boolean;
  tab: string;
  lang: string;
}) {
  const [config, setConfig] = useState<any>(null),
    wasActive = useRef(false);
  useEffect(() => {
    api("growth-config")
      .then(setConfig)
      .catch(() => {});
    return disableAnalytics;
  }, []);
  useEffect(() => {
    if (
      config?.enabled &&
      config.gaId &&
      consent &&
      !privatePage(location.href)
    ) {
      enableAnalytics(config.gaId);
      wasActive.current = true;
      analyticsPage();
    } else {
      disableAnalytics();
      if (wasActive.current && !consent) {
        wasActive.current = false;
        for (const part of document.cookie.split(";")) {
          const name = part.trim().split("=")[0];
          if (/^_ga(?:_|$)/.test(name))
            for (const domain of [
              "",
              location.hostname,
              "." + location.hostname,
            ])
              document.cookie =
                name +
                "=; Max-Age=0; path=/" +
                (domain ? "; domain=" + domain : "");
        }
        location.reload();
      }
    }
  }, [config, consent, tab, lang]);
  return null;
}
