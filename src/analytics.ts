import { privatePage, safePageUrl } from "../shared/attribution.ts";
type GAWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: string]: any;
};
let activeId = "",
  lastPage = "";
const allowedEvents = new Set([
  "view_item",
  "save_place",
  "remove_saved_place",
  "generate_route",
  "save_route",
  "map_click",
  "add_to_route",
  "click_affiliate",
  "share_route",
]);
export function disableAnalytics() {
  if (!activeId) return;
  const w = window as GAWindow;
  w["ga-disable-" + activeId] = true;
  activeId = "";
  lastPage = "";
}
export function enableAnalytics(id: string) {
  if (!/^G-[A-Z0-9]{6,20}$/.test(id)) return;
  const w = window as GAWindow;
  w["ga-disable-" + id] = false;
  activeId = id;
  if (document.getElementById("nowro-ga")) return;
  w.dataLayer = [];
  w.gtag = function (..._args: unknown[]) {
    w.dataLayer!.push(arguments);
  };
  w.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  let referrer = "";
  try {
    referrer = new URL(document.referrer).origin;
  } catch {}
  w.gtag("js", new Date());
  w.gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: safePageUrl(location.href),
    page_referrer: referrer,
  });
  const script = document.createElement("script");
  script.id = "nowro-ga";
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
  document.head.appendChild(script);
}
export function analyticsPage() {
  if (!activeId || privatePage(location.href)) return;
  const url = safePageUrl(location.href);
  if (url === lastPage) return;
  const previous = lastPage;
  lastPage = url;
  let referrer = "";
  try {
    referrer = previous || new URL(document.referrer).origin;
  } catch {}
  (window as GAWindow).gtag?.("event", "page_view", {
    page_location: url,
    page_title: document.title,
    page_referrer: referrer,
    send_to: activeId,
  });
}
export function track(name: string, id?: string,attributes:Record<string,string>={}) {
  if (!activeId || privatePage(location.href) || !allowedEvents.has(name))
    return;
  const params: Record<string, string> = {
    send_to: activeId,
    page_location: safePageUrl(location.href),
    page_referrer: "",
  };
  if (id && /^[a-zA-Z0-9_-]{1,100}$/.test(id)) params.item_id = id;
  for(const key of ['provider','place_id','lang','page','content_type'])if(attributes[key]&&/^[a-zA-Z0-9_-]{1,100}$/.test(attributes[key]))params[key]=attributes[key];
  (window as GAWindow).gtag?.("event", name, params);
}
