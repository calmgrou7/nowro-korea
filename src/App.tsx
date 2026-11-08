import { PlaceMaps } from "./PlaceMaps";
import {Analytics} from './AnalyticsLoader';
import {track} from './analytics';
import {syncPageMetadata} from '../shared/page-metadata';
import {AffiliateOffers} from './AffiliateOffers';
import {LocalizedDescription} from './LocalizedDescription';
import {RouteShare} from './RouteShare';
import {languagePath,urlLanguage} from '../shared/site-language';
import {koreaInput,koreaISO} from '../shared/korea-time';
import { visitorText } from "./visitor-copy";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { recommendationMessage } from "./recommendation-copy";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Clock,
  Compass,
  Map,
  Route as RouteIcon,
  Ticket,
  BookOpen,
  SlidersHorizontal,
  LocateFixed,
  ChevronDown,
  Check,
  Plus,
  X,
  RefreshCw,
  Bookmark,
  Footprints,
  Users,
  Wallet,
  Waves,
  Coffee,
  Utensils,
  Palette,
  ShoppingBag,
  Sparkles,
  Leaf,
  Trash2,
  ArrowUp,
  Copy,
  Navigation,
  ShieldCheck,
  Search,
  CalendarDays,
  UserRound,
} from "lucide-react";
import QRCode from "qrcode";
import type { Area, Place, Conditions, Route, Lang } from "../shared/types.ts";
import { distance } from "../shared/engine.ts";
import { placeMedia, scenery } from "../shared/media.ts";
import { api } from "./api";
import { t, initialLanguage, languages, names } from "./i18n";
import { MerchantListings, PublicListings, ListingDetail } from "./Listings";
import { Shop, CompletionRewards, AdminRewards } from "./Rewards";
import { Account } from "./Account";
import { BusinessApplicationPanel, AdminBusinesses } from "./Businesses";
import { EmailLinkSignIn } from "./EmailLinkSignIn";
import { useTabNavigation } from "./AppNavigation";
import { Modal } from "./Modal";
import { DistrictDirectory } from "./DistrictDirectory";
import { starterStampAreaIds } from "../shared/catalog";
import { AdminDashboard } from "./AdminDashboard";
import { OfficialPlaces } from "./OfficialPlaces";
import { SavedPlaces } from "./SavedPlaces";
import { Boards } from "./Boards";
import { RouteBenefits } from "./RouteBenefits";
import { eventExpired } from "../shared/event-dates";
import type { Listing } from "../shared/listings.ts";
const LiveMap = lazy(() => import("./MapView"));
type Tab = "NOW" | "MAP" | "ROUTES" | "TRIP" | "PASS" | "PASSPORT" | "ABOUT";
const tabs = [
  { id: "NOW" as Tab, icon: Compass },
  { id: "MAP" as Tab, icon: Map },
  { id: "ROUTES" as Tab, icon: RouteIcon },
  { id: "TRIP" as Tab, icon: Bookmark },
];
const icons: Record<string, typeof Waves> = {
  sea: Waves,
  cafe: Coffee,
  food: Utensils,
  culture: Palette,
  shopping: ShoppingBag,
  experience: Sparkles,
  wellness: Leaf,
  event: CalendarDays,
};
const krw = (n: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(n);
const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
const defaults: Conditions = {
  areaId: "",
  origin: { lat: 0, lng: 0 },
  minutes: 120,
  budget: 60000,
  interests: ["sea", "cafe"],
  transport: "walk",
  companion: "solo",
  startAt: new Date().toISOString(),
  returnPoint: null,
  deadline: null,
  children: false,
  accessible: false,
  diet: "",
  tripStart: "",
  tripEnd: "",
};
export default function App() {
  const [tab, setTab] = useTabNavigation();
  const [guideDistrict, setGuideDistrict] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [festivalCover, setFestivalCover] = useState<any>(null);
  useEffect(() => {
    api("festival-hero")
      .then(setFestivalCover)
      .catch(() => {});
  }, []);
  const [oauthHandled, setOauthHandled] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("listing");
    if (id)
      api("listings")
        .then((v) =>
          setListing(v.listings.find((x: Listing) => x.id === id) ?? null),
        )
        .catch(() => {});
  }, []);
  useEffect(() => {
    if (oauthHandled) return;
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    if (!accessToken) return;
    setOauthHandled(true);
    void api("auth/oauth", {
      accessToken,
      refreshToken: hash.get("refresh_token") || "",
    })
      .then(() => {
        history.replaceState({}, "", location.pathname + location.search);
        location.reload();
      })
      .catch(() => {
        history.replaceState({}, "", location.pathname + location.search);
      });
  }, [oauthHandled]);
  function openListing(v: Listing) {
    setListing(v);
    track('view_item','listing-'+v.id);
    if (!allListings.length)
      api("listings")
        .then((response) => setAllListings(response.listings))
        .catch(() => {});
  }
  function closeListing() {
    setListing(null);
  }
  const [lang, setLang] = useState<Lang>(initialLanguage),
    [catalog, setCatalog] = useState<{
      areas: Area[];
      places: Place[];
      coupons: any[];
      cities: any[];
    } | null>(null),
    [status, setStatus] = useState<any>(null),
    [wallet, setWallet] = useState<any>({
      trips: [],
      vouchers: [],
      stamps: [],
    }),
    [c, setC] = useState<Conditions>(() => {
      try {
        const v = sessionStorage.getItem("nowro-conditions");
        return v ? { ...defaults, ...JSON.parse(v) } : defaults;
      } catch {
        return defaults;
      }
    }),
    [routes, setRoutes] = useState<Route[] | null>(null),
    [routeFeedback, setRouteFeedback] = useState(""),
    [emptyReason, setEmptyReason] = useState(""),
    [selected, setSelected] = useState<Route | null>(null),
    [place, setPlace] = useState<Place | null>(null),
    [settings, setSettings] = useState(false),
    [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState(false),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [browseArea, setBrowseArea] = useState("all"),
    [filter, setFilter] = useState("all"),
    [mapView, setMapView] = useState(false),
    [natural, setNatural] = useState(""),
    [extracted, setExtracted] = useState<any>(null),
    [consent, setConsent] = useState({ analytics: false, location: false }),
    [token, setToken] = useState(
      new URLSearchParams(location.search).get("stamp") || "",
    ),
    [operator, setOperator] = useState<any>(null),
    [siteContent, setSiteContent] = useState<any>(null),
    [openApiSources, setOpenApiSources] = useState<any[]>([]),
    [role, setRole] = useState("traveler"),
    [voucherCode, setVoucherCode] = useState(""),
    [spend, setSpend] = useState(7000),
    [paymentId, setPaymentId] = useState(""),
    [paymentRef, setPaymentRef] = useState(""),
    [paymentAmount, setPaymentAmount] = useState(7000),
    [qr, setQr] = useState<{
      token: string;
      expires: number;
      image: string;
    } | null>(null),
    [proposalCost, setProposalCost] = useState(11000),
    [proposalStay, setProposalStay] = useState(35),
    [report, setReport] = useState(false),
    [reportText, setReportText] = useState("");
  const T = (key: string) => t(key, lang);
  useEffect(() => {
    api("site-content")
      .then((v) => setSiteContent(v.content))
      .catch(() => {});
    api("openapi/sources")
      .then((v) => setOpenApiSources(v.sources || []))
      .catch(() => {});
  }, []);
  const scannedOnce = useRef(false);
  useEffect(() => {
    const scanned = new URLSearchParams(location.search).get("stamp");
    if (!status || !status.canTravel || !scanned || scannedOnce.current) return;
    scannedOnce.current = true;
    void action(async () => {
      await api("stamps/claim", { token: scanned });
      setToken("");
      history.replaceState({}, "", location.pathname);
      await refresh();
      setToast(
        visitorText(lang, "결제 확인 스탬프가 등록되었습니다.", "Paid-visit stamp registered."),
      );
    });
  }, [status]);
  const name = (p: { name: Record<Lang, string> }) => p.name[lang] || p.name.en;
  const refresh = async () => {
    const [cat, st] = await Promise.all([api("catalog"), api("status")]);
    // Load private data for the verified session before publishing a new identity to the UI.
    let records: any, nextConsent: any, nextWallet: any;
    try {
      [records, nextConsent, nextWallet] = await Promise.all([
        st.session.role === "traveler"
          ? Promise.resolve(null)
          : api("operator"),
        api("consent"),
        st.canTravel
          ? api("wallet")
          : Promise.resolve({ trips: [], vouchers: [], stamps: [] }),
      ]);
    } catch (error) {
      setWallet({ trips: [], vouchers: [], stamps: [] });
      setOperator(null);
      throw error;
    }
    setCatalog(cat);
    setC((old) =>
      cat.areas.some((a: Area) => a.id === old.areaId)
        ? old
        : {
            ...old,
            areaId: cat.cities[0].defaultAreaId || cat.areas[0].id,
            origin: (
              cat.areas.find(
                (a: Area) => a.id === cat.cities[0].defaultAreaId,
              ) || cat.areas[0]
            ).point,
          },
    );
    setStatus(st);
    setRole((old) =>
      old === "traveler" && st.session.role === "partner" && st.canTravel
        ? "traveler"
        : st.session.role,
    );
    setWallet(nextWallet);
    setOperator(records);
    setConsent({
      analytics: !!nextConsent.analytics && nextConsent.version === 'analytics-2026-11-08',
      location: !!nextConsent.location,
    });
    return st;
  };
  useEffect(() => {
    refresh().catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    const current=new URL(location.href);current.pathname=languagePath(lang);current.searchParams.delete('lang');history.replaceState(history.state,'',current);syncPageMetadata();
    try {
      localStorage.setItem("nowro-language", lang);
    } catch {}
  }, [lang]);
  useEffect(()=>{const restore=()=>{const next=urlLanguage(new URL(location.href));if(next)setLang(next);};addEventListener('popstate',restore);return()=>removeEventListener('popstate',restore);},[]);
  const recommendationSeq = useRef(0);
  useEffect(() => {
    recommendationSeq.current++;
    setRoutes(null);
    setEmptyReason("");
    setRouteFeedback("");
    try { sessionStorage.setItem("nowro-conditions", JSON.stringify(c)); } catch {}
  }, [c]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (token) setTab("PASSPORT");
  }, []);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const code = (e as Error).message;
      setToast(
        T(
          code === "INFEASIBLE_ROUTE" || code === "INVALID_CONDITIONS"
            ? "invalidRoute"
            : /ALREADY|EXPIRED|REPLAY|SOLD_OUT|PAUSED|INVALID_QR/.test(code)
              ? "duplicate"
              : "error",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function update<K extends keyof Conditions>(key: K, v: Conditions[K]) {
    setRoutes(null);
    setC((old) => ({ ...old, [key]: v }));
  }
  function areaChange(id: string) {
    setRoutes(null);
    const a = catalog?.areas.find((a) => a.id === id);
    if (a)
      setC((old) => ({
        ...old,
        areaId: id,
        origin: a.point,
        requiredPlaceId: undefined,
        requiredPlaceIds: undefined,
      }));
  }
  async function generate(conditions = c) {
    if (busy) return;
    if (
      catalog?.places.some((p) => p.planningEstimate) &&
      !conditions.allowPlanningEstimates
    ) {
      setRouteFeedback(recommendationMessage("planning_confirmation_required", lang));
      document.getElementById("planning-estimates")?.focus();
      return;
    }
    const attempt = ++recommendationSeq.current;
    setBusy(true);
    setRouteFeedback("");
    setRoutes(null);
    try {
      const data = await api("recommend", { conditions });
      if (attempt !== recommendationSeq.current) return;
      if (!Array.isArray(data.routes)) throw new Error("INVALID_RESPONSE");
      if (Array.isArray(data.places)) {
        setCatalog(previous => previous ? {...previous, places: [...previous.places.filter(p => !data.places.some((next:Place) => next.id === p.id)), ...data.places]} : previous);
      }
      if (data.routes.length)
        setToast(
          visitorText(lang, "공식 API 장소 기반 예상 코스입니다. 운영시간·요금·예약 여부는 방문 전 확인해주세요.", "Route uses official API places. Hours, fees and reservations require venue confirmation."),
        );
      setRoutes(data.routes);
      if(data.routes.length)track('generate_route');
      setEmptyReason(data.diagnostic || "conditions_too_restrictive");
      setTab("ROUTES");
      api("events", { name: "recommend" }).catch(() => {});
      setTimeout(
        () =>
          document
            .getElementById("results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    } catch (error) {
      if (attempt === recommendationSeq.current)
        setRouteFeedback(recommendationMessage(error instanceof Error && error.message === "INVALID_CONDITIONS" ? "invalid_conditions" : "connection_error", lang));
    } finally { setBusy(false); }
  }
  async function openPlanner(item?: any) {
    if (item?.UC_SEQ) {
      const refreshed = await api("catalog").catch(() => catalog);
      if (refreshed) setCatalog(refreshed);
      const chosen = refreshed?.places.find(
        (p: Place) => p.id === item.routePlaceId,
      );
      if (!chosen) {
        setToast(
          visitorText(lang, "이 장소는 위치 정보 확인 후 코스에 추가할 수 있습니다. 현재는 지도에서 위치를 확인해주세요.", "This place is not available for route planning yet. Please check its location on the map."),
        );
        return false;
      }
      setC((old) => ({
        ...old,
        areaId: chosen.areaId,
        origin: chosen.point,
        requiredPlaceId: chosen.id,
        requiredPlaceIds: undefined,
      }));
      track('add_to_route',chosen.id);
      setRoutes(null);
    }
    setTab("ROUTES");
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  }
  async function planSaved(items: any[]) {
    if (!items.length || items.length > 4) return false;
    if (items.some((item) => eventExpired(item))) {
      setToast(
        visitorText(lang, "종료된 일정은 코스에 포함할 수 없습니다. 해당 항목을 해제해주세요.", "Ended events cannot be included in a route. Please deselect them."),
      );
      return false;
    }
    const refreshed = await api("catalog").catch(() => catalog);
    if (refreshed) setCatalog(refreshed);
    const chosen = items.map((item) =>
      refreshed?.places.find((p: Place) => p.id === item.routePlaceId),
    );
    if (chosen.some((p) => !p)) {
      setToast(
        visitorText(lang, "일부 항목은 위치·일정 확인이 필요해 아직 코스로 계산할 수 없습니다. 해당 항목을 해제해주세요.", "Some items are not route-ready. Deselect items whose location or schedule is unverified."),
      );
      return false;
    }
    const points = chosen as Place[];
    setC((old) => ({
      ...old,
      areaId: points[0].areaId,
      origin: points[0].point,
      requiredPlaceId: undefined,
      requiredPlaceIds: points.map((p) => p.id),
    }));
    setRoutes(null);
    return openPlanner();
  }
  function gps() {
    if (!consent.location) {
      setSettings(true);
      setToast(T("gpsConsent"));
      return;
    }
    if (!navigator.geolocation) {
      setToast(T("gpsFail"));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const a = [...(catalog?.areas || [])].sort(
          (a, b) => distance(a.point, point) - distance(b.point, point),
        )[0];
        if (!a || distance(a.point, point) > 8) setToast(T("gpsOutside"));
        else {
          setC((old) => ({ ...old, areaId: a.id, origin: point }));
          setToast(T("districtSuggested"));
        }
        setBusy(false);
      },
      () => {
        setToast(T("gpsFail"));
        setBusy(false);
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }
  async function changeRoute(ids: string[]) {
    if (!selected) return;
    await action(async () => {
      const data = await api("recalculate", {
        placeIds: ids,
        conditions: selected.conditions,
      });
      setSelected(data.route);
    });
  }
  const openPlace = (p: Place) => {
    setPlace(p);
    track('view_item',p.id);
    setReport(false);
    api("events", { name: "place_view" }).catch(() => {});
  };
  const toggleInterest = (id: string) =>
    update(
      "interests",
      c.interests.includes(id)
        ? c.interests.filter((x) => x !== id)
        : [...c.interests, id],
    );
  const area = catalog?.areas.find((a) => a.id === c.areaId);
  const mapOrigin =
    catalog?.areas.find((a) => a.id === browseArea)?.point || c.origin;
  const matchingPlaces =
    catalog?.places.filter((p) => {
      const words = query
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const region = catalog.areas.find((a) => a.id === p.areaId);
      const text = [
        ...Object.values(p.name),
        ...Object.values(region?.name ?? {}),
        ...Object.values(region?.aliases ?? {}),
        p.address,
        T(p.category),
        p.category,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (browseArea === "all" || p.areaId === browseArea) &&
        (filter === "all" || p.category === filter) &&
        words.every((word) => text.includes(word))
      );
    }) ?? [];
  function explore(category = "all", scope = "all") {
    setFilter(category);
    setBrowseArea(scope);
    setTab("MAP");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function navigate(id: Tab) {
    setTab(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const art = (p: Place, small = false) => (
    <div className={`place-art photo ${small ? "small" : ""}`}>
      <img
        src={placeMedia(p).src}
        alt={placeMedia(p).alt}
        loading="lazy"
        decoding="async"
      />
      {placeMedia(p).generated && (
        <small className="media-badge">{T("aiImage")}</small>
      )}
      <span>{T(p.category)}</span>
    </div>
  );
  const placeCard = (p: Place) => (
    <button className="place-card" key={p.id} onClick={() => openPlace(p)}>
      {art(p)}
      <div className="card-copy">
        <span className="eyebrow">
          {name(catalog!.areas.find((a) => a.id === p.areaId)!)}
        </span>
        <h3>{name(p)}</h3>
        <p>
          <Clock size={14} />
          {p.stay} min <span>·</span> {krw(p.costMax)}
        </p>
        {p.sample && <span className="sample-label">{T("sample")}</span>}
        <ArrowUpRight className="corner-arrow" size={20} />
      </div>
    </button>
  );
  const routeCard = (r: Route, i: number) => (
    <article className="route-card" key={r.id}>
      <div className="route-top">
        <span className="route-number">0{i + 1}</span>
        <span className="pill">
          <Check size={13} />
          {T("estimated")}
        </span>
      </div>
      <h3>
        {r.stops
          .map((s) => { const place = catalog!.places.find((p) => p.id === s.placeId); return place ? name(place) : (visitorText(lang, "장소 정보 확인 필요", "Place details unavailable")); })
          .join(" → ")}
      </h3>
      <p>{T("reason")}</p>
      <div className="route-metrics">
        <span>
          <Clock size={17} />
          <strong>{r.minutes} min</strong>
        </span>
        <span>
          <Wallet size={17} />
          <strong>{krw(r.costMax)}</strong>
        </span>
        <span>
          {r.stops.length} {T("stops")}
        </span>
      </div>
      <small>
        {clock(r.startAt)}–{clock(r.endAt)} · {T(r.conditions.transport)} ·{" "}
        {r.sample
          ? T("sample")
          : visitorText(lang, "계획용 예상 · 영업·요금 미확인", "Planning estimate · hours and fees unverified")}
      </small>
      <button className="secondary full" onClick={() => setSelected(r)}>
        {T("view")}
        <ArrowRight size={16} />
      </button>
    </article>
  );
  const changeRole = (r: string) =>
    action(async () => {
      if (status?.operatorPreview) {
        await api("preview-role", { role: r });
        await refresh();
      } else {
        if (
          r !== status?.session.role &&
          !(r === "traveler" && status?.canTravel)
        )
          throw new Error("FORBIDDEN");
        setRole(r);
      }
      setSettings(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  if (loadError)
    return (
      <main className="load-error">
        <h1>
          NOWRO<span>↗</span>
        </h1>
        <p>{T("error")}</p>
        <button
          className="primary"
          onClick={() =>
            action(async () => {
              await refresh();
              setLoadError(false);
            })
          }
        >
          {T("retry")}
        </button>
      </main>
    );
  if (!catalog)
    return (
      <main className="load-error">
        <h1>
          NOWRO<span>↗</span>
        </h1>
        <p>{T("loading")}</p>
      </main>
    );
  const plannerView = (
    <section id="planner" className="planner" aria-label={T("plan")}>
      {c.requiredPlaceId && (
        <p className="notice">
          {visitorText(lang, "포함할 장소: ", "Include: ")}
          {catalog.places.find((p) => p.id === c.requiredPlaceId)?.name[lang] ||
            c.requiredPlaceId}
          <button
            className="text-btn"
            onClick={() => update("requiredPlaceId", undefined)}
          >
            {visitorText(lang, "선택 해제", "Clear")}
          </button>
        </p>
      )}
      {!!c.requiredPlaceIds?.length && (
        <p className="notice">
          {visitorText(lang, "선택한 장소: ", "Selected places: ")}
          {c.requiredPlaceIds
            .map(
              (id) => catalog.places.find((p) => p.id === id)?.name[lang] || id,
            )
            .join(" · ")}
          <button
            className="text-btn"
            onClick={() => update("requiredPlaceIds", undefined)}
          >
            {visitorText(lang, "선택 해제", "Clear")}
          </button>
        </p>
      )}
      <div className="planner-heading">
        <div>
          <span className="eyebrow">YOUR NEXT MOVE</span>
          <h2>{T("plan")}</h2>
        </div>
        <span className="no-login">
          <ShieldCheck size={15} />
          {T("noSignup")}
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
      >
        <div className="route-date-row"><label>{T('startAt')}<input type="datetime-local" required value={koreaInput(c.startAt)} onInput={e=>{const value=koreaISO(e.currentTarget.value);if(value)update('startAt',value);}} onChange={e=>{const value=koreaISO(e.target.value);if(value)update('startAt',value);}}/></label><p className="muted">{lang==='ko'?'부산 현지 시간(UTC+9)입니다. 행사를 포함했다면 해당 행사 기간에 맞는 날짜를 선택하세요.':'Busan local time (UTC+9). If your route includes an event, choose a date within its scheduled period.'}</p></div>
        <div className="planner-grid">
          <div className="form-block">
            <label htmlFor="area">
              <MapPin size={17} />
              {T("where")}
            </label>
            <select
              id="area"
              value={c.areaId}
              onChange={(e) => areaChange(e.target.value)}
            >
              {catalog.areas.map((a) => (
                <option value={a.id} key={a.id}>
                  {lang === "ko" ? a.name.ko : `${name(a)} / ${a.name.ko}`}
                </option>
              ))}
            </select>
            {area && <small className="muted">{area.aliases[lang]}</small>}
            <small className="muted">{visitorText(lang, "출발점 기준 도보 3km · 대중교통/차량 8km 내 인접 구·군도 함께 추천합니다. 실제 이동시간은 예상치입니다.", "Includes nearby districts within 3 km on foot or 8 km by transit/car from your start. Travel times are estimates.")}</small>
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={gps}
            >
              <LocateFixed size={14} />
              {T("gps")}
            </button>
          </div>
          <div className="form-block time-block">
            <label>
              <Clock size={17} />
              {T("time")}
            </label>
            <div className="time-options">
              {[
                ["two", 120],
                ["four", 240],
                ["half", 360],
                ["day", 540],
              ].map(([key, n]) => (
                <button
                  type="button"
                  aria-pressed={c.minutes === n}
                  className={c.minutes === n ? "chosen" : ""}
                  key={key}
                  onClick={() => update("minutes", n as number)}
                >
                  {T(key as string)}
                </button>
              ))}
            </div>
            <label className="compact-label">
              {T("minutes")}
              <input
                aria-label={T("minutes")}
                type="number"
                min="30"
                max="720"
                value={c.minutes}
                onChange={(e) => update("minutes", Number(e.target.value))}
              />
            </label>
          </div>
          <div className="form-block">
            <label htmlFor="budget">
              <Wallet size={17} />
              {T("budget")}
            </label>
            <div className="budget-input">
              <span>₩</span>
              <input
                id="budget"
                type="number"
                min="0"
                max="10000000"
                step="1000"
                value={c.budget}
                onChange={(e) => update("budget", Number(e.target.value))}
              />
              <span>KRW</span>
            </div>
          </div>
        </div>
        <div className="planner-bottom">
          <div>
            <label>{T("interests")}</label>
            <div className="interest-chips">
              {Object.entries(icons).map(([id, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={c.interests.includes(id)}
                  className={c.interests.includes(id) ? "chosen" : ""}
                  onClick={() => toggleInterest(id)}
                >
                  <Icon size={15} />
                  {T(id)}
                </button>
              ))}
            </div>
          </div>
          <div className="planner-submit">
      {(
        <label className="estimate-consent">
          <input
            id="planning-estimates" type="checkbox"
            checked={!!c.allowPlanningEstimates}
            onChange={(e) => update("allowPlanningEstimates", e.target.checked)}
          />
          {visitorText(lang, "운영시간·요금·예약 여부 미확인 장소를 계획용 코스에 포함합니다. 방문 가능 여부와 실제 비용은 직접 확인해야 합니다.", "Include places with unverified hours, fees and reservations in a planning-only route. Confirm availability and actual costs before visiting.")}
        </label>
      )}
          <button className="primary main-cta" disabled={busy}>
            {busy ? T("loading") : T("go")}
            <ArrowUpRight size={21} />
          </button>
{routeFeedback && <p className="route-feedback" role="alert">{routeFeedback}</p>}
          </div>
        </div>
        <p className="cost-note">{T("costNote")}</p>
        <details className="advanced">
          <summary>
            {T("advanced")}
            <ChevronDown size={15} />
          </summary>
          <div className="advanced-grid">
            <label>
              {T("companion")}
              <select
                value={c.companion}
                onChange={(e) => update("companion", e.target.value)}
              >
                {["solo", "couple", "friends", "family"].map((x) => (
                  <option key={x} value={x}>
                    {T(x)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {T("transport")}
              <select
                value={c.transport}
                onChange={(e) =>
                  update("transport", e.target.value as Conditions["transport"])
                }
              >
                {["walk", "transit", "car"].map((x) => (
                  <option key={x} value={x}>
                    {T(x)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {T("lat")}
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={c.origin.lat}
                onChange={(e) =>
                  update("origin", {
                    ...c.origin,
                    lat: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              {T("lng")}
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={c.origin.lng}
                onChange={(e) =>
                  update("origin", {
                    ...c.origin,
                    lng: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              {T("diet")}
              <select
                value={c.diet}
                onChange={(e) => update("diet", e.target.value)}
              >
                <option value="">{T("none")}</option>
                <option value="vegetarian">Vegetarian / 채식</option>
                <option value="halal">Halal / 할랄</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.children}
                onChange={(e) => update("children", e.target.checked)}
              />
              {T("children")}
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={c.accessible}
                onChange={(e) => update("accessible", e.target.checked)}
              />
              {T("accessible")}
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!c.returnPoint}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setC((old) => ({
                    ...old,
                    returnPoint: checked ? { ...old.origin } : null,
                    deadline: checked ? old.deadline : null,
                  }));
                }}
              />
              {T("returnTo")}
            </label>
            {c.returnPoint && (
              <>
                <label>
                  {T("lat")}
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={c.returnPoint.lat}
                    onChange={(e) =>
                      update("returnPoint", {
                        ...c.returnPoint!,
                        lat: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  {T("lng")}
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={c.returnPoint.lng}
                    onChange={(e) =>
                      update("returnPoint", {
                        ...c.returnPoint!,
                        lng: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  {T("deadline")}
                  <input
                    type="datetime-local"
                    value={c.deadline ? koreaInput(c.deadline) : ""}
                    onChange={(e) =>
                      update(
                        "deadline",
                        e.target.value ? koreaISO(e.target.value) : null,
                      )
                    }
                  />
                </label>
              </>
            )}
            <label>
              {T("tripDates")}
              <div className="inline">
                <input
                  aria-label="Trip start"
                  type="date"
                  value={c.tripStart}
                  onChange={(e) => update("tripStart", e.target.value)}
                />
                <input
                  aria-label="Trip end"
                  type="date"
                  min={c.tripStart}
                  value={c.tripEnd}
                  onChange={(e) => update("tripEnd", e.target.value)}
                />
              </div>
            </label>
          </div>
        </details>
      </form>
      <details className="natural">
        <summary>
          <Sparkles size={15} />
          {T("natural")}
        </summary>
        <p className="muted">{T("aiPrivacy")}</p>
        <textarea
          value={natural}
          maxLength={500}
          onChange={(e) => setNatural(e.target.value)}
          placeholder="Gwangalli, 4 hours, ocean and coffee, under KRW 60,000."
          aria-label={T("natural")}
        />
        <button
          className="secondary"
          disabled={busy || natural.length < 2}
          onClick={() =>
            action(async () => {
              const data = await api("ai/extract", {
                text: natural,
              });
              setExtracted(data.conditions);
              if (!data.conditions) setToast(T("aiOff"));
            })
          }
        >
          {T("extract")}
        </button>
        {extracted && (
          <div className="extracted">
            <p>
              {extracted.areaId || c.areaId} · {extracted.minutes ?? c.minutes}{" "}
              min · {krw(extracted.budget ?? c.budget)} ·{" "}
              {extracted.interests.map((x: string) => T(x)).join(", ")}
            </p>
            <button
              className="secondary"
              onClick={() => {
                setC((old) => ({
                  ...old,
                  areaId: extracted.areaId || old.areaId,
                  origin:
                    catalog.areas.find((a) => a.id === extracted.areaId)
                      ?.point || old.origin,
                  minutes: extracted.minutes ?? old.minutes,
                  budget: extracted.budget ?? old.budget,
                  interests: extracted.interests.length
                    ? extracted.interests
                    : old.interests,
                }));
                setExtracted(null);
              }}
            >
              {T("apply")}
              <Check size={15} />
            </button>
          </div>
        )}
      </details>
    </section>
  );
  return (
    <>
      <Analytics consent={consent.analytics && status?.session?.role==='traveler'} tab={tab} lang={lang}/>
      <EmailLinkSignIn lang={lang} onChange={refresh} />

      <header className="topbar">
        <button
          className="brand brand-logo"
          aria-label={`NOWRO Korea · ${T("navNOW")}`}
          onClick={() => {
            navigate("NOW");
            // The brand is a true home escape from the operator dashboard.
            // Keep the authenticated role on the server, but show traveler UI.
            setRole("traveler");
          }}
        >
          <img
            src="/brand/logo.webp"
            alt="NOWRO — Your Korea. Right Now."
            width="746"
            height="182"
          />
        </button>
        {role === "traveler" && (
          <nav className="desktop-nav" aria-label="Main navigation">
            {[
              { id: "NOW" as Tab, ko: "홈", en: "Home" },
              { id: "MAP" as Tab, ko: "지역가이드", en: "Local guides" },
              { id: "ROUTES" as Tab, ko: "코스", en: "Routes" },
              { id: "TRIP" as Tab, ko: "저장", en: "Saved" },
              { id: "ABOUT" as Tab, ko: "나우로 소개", en: "About NOWRO" },
            ].map(({ id, ko, en }) => (
              <button
                key={ko}
                className={tab === id ? "active" : ""}
                onClick={() => navigate(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                {visitorText(lang, ko, en)}
              </button>
            ))}
          </nav>
        )}
        <div className="top-actions">
          <span className="city">
            <MapPin size={15} />
            {name(catalog.cities[0])} · Korea
          </span>
          <label className="language-select">
            <span className="sr-only">{T("language")}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              {languages.map((l, i) => (
                <option value={l} key={l}>
                  {names[i]}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <button
            className="icon-btn account-shortcut"
            aria-label={
              status?.session.authenticated ? T("account") : T("signIn")
            }
            onClick={() => setSettings(true)}
            title={status?.session.authenticated ? T("account") : T("signIn")}
          >
            <UserRound size={20} />
          </button>
          <button
            className="icon-btn"
            aria-label={T("settings")}
            onClick={() => setSettings(true)}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </header>
      <main className="page">
        {role !== "traveler" ? (
          <section className="operator-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  NOWRO {role === "admin" ? "ADMIN" : "OPERATOR"}
                </span>
                <h1>{T(role)}</h1>
              </div>
              <button
                className="secondary"
                onClick={() => changeRole("traveler")}
              >
                <ArrowLeft size={16} />
                {T("traveler")}
              </button>
            </div>
            <p className="notice">
              {status?.session.authenticated
                ? visitorText(lang, "로그인한 운영 계정입니다. 업체 승인과 상품 게시 심사는 별도로 진행됩니다.", "Signed-in operator account. Business approval and listing publication are reviewed separately.")
                : T("operatorNote")}
            </p>
            {role === "admin" && <AdminDashboard />}
            {role === "admin" && (
              <AdminBusinesses lang={lang} areas={catalog.areas} />
            )}
            <MerchantListings
              lang={lang}
              role={role}
              areas={catalog.areas}
              business={operator?.business}
            />
            {role === "admin" && <AdminRewards lang={lang} />}
            {operator && (role === "admin" || operator.places.length > 0) && (
              <>
                <div className="operator-grid">
                  <section className="panel">
                    <h2>Coupon confirmation</h2>
                    <p className="muted">
                      Only owned-business coupons can be redeemed. No traveler
                      details are shown.
                    </p>
                    <label>
                      Voucher code
                      <input
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.trim())}
                      />
                    </label>
                    <label>
                      Receipt amount · KRW
                      <input
                        type="number"
                        min="0"
                        value={spend}
                        onChange={(e) => setSpend(Number(e.target.value))}
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={busy || !voucherCode}
                      onClick={() =>
                        action(async () => {
                          await api("coupons/redeem", {
                            voucherId: voucherCode,
                            total: spend,
                          });
                          await refresh();
                          setToast(T("success"));
                        })
                      }
                    >
                      Confirm redemption
                      <Check size={16} />
                    </button>
                    {operator.coupons.map((v: any) => (
                      <div className="operator-row" key={v.id}>
                        <span>
                          {v.id}
                          <small>
                            Issued {v.issued}/{v.cap} · Used {v.used}
                          </small>
                        </span>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              await api("coupons/pause", {
                                couponId: v.id,
                                paused: !v.paused,
                              });
                              await refresh();
                            })
                          }
                        >
                          {v.paused ? "Resume" : "Pause"}
                        </button>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <h2>On-site stamp code</h2>
                    <p className="muted">
                      {visitorText(lang, "결제 확인 → 현장 QR 발급 → 고객 스캔 → 서버 스탬프 등록. 실제 결제 연동 전에는 로컬 테스트만 가능합니다.", "Payment confirmation → on-site QR → customer scan → server stamp. Local testing only until payments are connected.")}
                    </p>
                    {status?.operatorPreview && (
                      <>
                        <label>
                          {visitorText(lang, "테스트 결제 참조번호", "Test receipt reference")}
                          <input
                            value={paymentRef}
                            maxLength={80}
                            onChange={(e) => {
                              setPaymentRef(e.target.value);
                              setPaymentId("");
                              setQr(null);
                            }}
                          />
                        </label>
                        <label>
                          {visitorText(lang, "결제 금액 (KRW)", "Payment amount (KRW)")}
                          <input
                            type="number"
                            min={1}
                            max={10000000}
                            value={paymentAmount}
                            onChange={(e) => {
                              setPaymentAmount(Number(e.target.value));
                              setPaymentId("");
                              setQr(null);
                            }}
                          />
                        </label>
                        <button
                          className="secondary"
                          disabled={
                            busy || !!paymentId || paymentRef.length < 3
                          }
                          onClick={() =>
                            action(async () => {
                              const p = await api("payments/test", {
                                placeId: operator.places[0].id,
                                reference: paymentRef,
                                amount: paymentAmount,
                              });
                              setPaymentId(p.id);
                            })
                          }
                        >
                          {paymentId
                            ? visitorText(lang, "테스트 결제 확인됨", "Test payment confirmed")
                            : visitorText(lang, "테스트 결제 확인", "Confirm test payment")}
                        </button>
                      </>
                    )}
                    <p className="muted">
                      One visitor per code · expires in 2 minutes · GPS is not
                      proof of a visit.
                    </p>
                    <button
                      className="primary"
                      disabled={busy || !paymentId}
                      onClick={() =>
                        action(async () => {
                          const code = await api("stamps/challenge", {
                            placeId: operator.places[0].id,
                            paymentId,
                          });
                          const image = await QRCode.toDataURL(
                            location.origin +
                              "/?stamp=" +
                              encodeURIComponent(code.token),
                            { width: 230, margin: 2 },
                          );
                          setQr({ ...code, image });
                        })
                      }
                    >
                      Generate signed QR
                      <Plus size={16} />
                    </button>
                    {qr && (
                      <div className="qr-box">
                        <img
                          src={qr.image}
                          alt="Signed on-site verification QR"
                        />
                        <small>
                          Expires {clock(new Date(qr.expires).toISOString())}
                        </small>
                        <textarea
                          aria-label="Alternative on-site code"
                          readOnly
                          value={qr.token}
                        />
                        <button
                          className="secondary"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(qr.token)
                              .then(() => setToast(T("success")))
                              .catch(() => setToast(T("error")))
                          }
                        >
                          <Copy size={15} />
                          Copy alternative code
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Place edit request</h2>
                    <p className="muted">
                      Changes remain pending until an administrator approves
                      them.
                    </p>
                    <label>
                      Maximum price · KRW
                      <input
                        type="number"
                        min="0"
                        value={proposalCost}
                        onChange={(e) =>
                          setProposalCost(Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Stay · minutes
                      <input
                        type="number"
                        min="10"
                        max="240"
                        value={proposalStay}
                        onChange={(e) =>
                          setProposalStay(Number(e.target.value))
                        }
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await api("operator/proposal", {
                            placeId: operator.places[0].id,
                            patch: {
                              costMax: proposalCost,
                              stay: proposalStay,
                            },
                          });
                          await refresh();
                          setToast(T("success"));
                        })
                      }
                    >
                      Submit for review
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
                <section className="panel">
                  <h2>Review queue</h2>
                  {operator.proposals.length === 0 ? (
                    <p className="muted">No edit requests.</p>
                  ) : (
                    operator.proposals.map((p: any) => (
                      <div className="operator-row" key={p.id}>
                        <span>
                          {p.place_id}
                          <small>
                            {krw(p.data.costMax)} · {p.data.stay} min ·{" "}
                            {p.status}
                          </small>
                        </span>
                        {role === "admin" && p.status === "pending" && (
                          <div className="inline">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                action(async () => {
                                  await api("operator/approve", {
                                    id: p.id,
                                    approved: false,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              Reject
                            </button>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() =>
                                action(async () => {
                                  await api("operator/approve", {
                                    id: p.id,
                                    approved: true,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </section>
                {role === "admin" && (
                  <section className="panel">
                    <h2>Audit log</h2>
                    {operator.audit.map((a: any, i: number) => (
                      <div className="audit-row" key={i}>
                        <b>{a.event}</b>
                        <time>{a.created}</time>
                        <code>{a.detail}</code>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}
          </section>
        ) : (
          <>
            {
              <div
                className="home-sections"
                style={tab === "NOW" ? undefined : { display: "none" }}
              >
                <section className="hero hero-photo-intro">
                  <div className="hero-copy">
                    <span className="eyebrow">
                      <span className="status-dot" />
                      YOUR KOREA. RIGHT NOW.
                    </span>
                    <h1>
                      {siteContent?.[
                        lang === "ko" ? "hero_title_ko" : "hero_title_en"
                      ] || T("hero")}
                    </h1>
                    <p>
                      {siteContent?.[
                        lang === "ko" ? "hero_intro_ko" : "hero_intro_en"
                      ] || T("intro")}
                    </p>
                    <div className="hero-tags">
                      <span>
                        <Users size={15} />
                        {T("everyone")}
                      </span>
                      <span>
                        <Footprints size={15} />
                        {T("walk")}
                      </span>
                    </div>
                    <div className="hero-foot">
                      <span>01 — BUSAN, KOREA</span>
                      <ArrowUpRight size={28} />
                    </div>
                  </div>
                  <div className="hero-image">
                    <img
                      src="/images/busan-fireworks.webp"
                      alt={festivalCover?.title || "NOWRO"}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                      fetchPriority="high"
                    />
                    <div className="image-label">
                      <span>
                        <MapPin size={14} />
                        {festivalCover?.title ||
                          (visitorText(lang, "부산 축제 이미지 준비 중", "Busan festival cover"))}
                      </span>
                      <small>
                        <a
                          href={
                            festivalCover?.source ||
                            "https://www.visitbusan.net/"
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {visitorText(lang, "사진: 부산광역시 축제 API · 자료 이미지", "Photo: Busan festival API · archive image")}
                        </a>{" "}
                        ·{" "}
                        <a
                          href="https://www.data.go.kr/data/15063500/openapi.do"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {visitorText(lang, "공식 출처", "Official source")}
                        </a>
                      </small>
                    </div>
                    <div className="image-note">
                      GO LOCAL.
                      <br />
                      FEEL MORE.<span>↗</span>
                    </div>
                  </div>
                </section>
                <OfficialPlaces
                  lang={lang}
                  onPlan={openPlanner}
                  onPlanMany={planSaved}
                />
                <section className="panel planner-entry">
                  <span className="eyebrow">YOUR NEXT MOVE</span>
                  <h2>{T("plan")}</h2>
                  <p>
                    {visitorText(lang, "지금 있는 곳과 남은 시간, 예산에 맞춰 여행코스를 만들어보세요.", "Plan a route around your location, available time and budget.")}
                  </p>
                  <button className="primary" onClick={() => openPlanner()}>
                    <RouteIcon size={17} />
                    {visitorText(lang, "바로 코스 만들기", "Build my route")}
                  </button>
                </section>
                <section className="home-saved">
                  <div className="panel">
                    <h2>
                      {visitorText(lang, "저장한 장소로 나만의 코스 만들기", "Build a route from your saved places")}
                    </h2>
                    <p className="muted">
                      {visitorText(lang, "마음에 드는 장소를 모아두고, 저장 화면에서 함께 갈 장소를 골라보세요.", "Collect places you like, then choose your stops together in Saved.")}
                    </p>
                    <button
                      className="primary"
                      onClick={() => navigate("TRIP")}
                    >
                      <Bookmark size={16} />
                      {visitorText(lang, "저장한 장소 보기", "View saved places")}
                    </button>
                  </div>
                </section>
                {siteContent?.news_title && (
                  <section className="section news-board">
                    <h2>{visitorText(lang, "새로운 소식", "News")}</h2>
                    <article className="source-card">
                      {siteContent.news_image?.startsWith("https://") && (
                        <img
                          src={siteContent.news_image}
                          alt=""
                          style={{
                            width: "100%",
                            maxHeight: 320,
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <h3>{siteContent.news_title}</h3>
                      <p style={{ whiteSpace: "pre-line" }}>
                        {siteContent.news_body}
                      </p>
                    </article>
                  </section>
                )}
                <AffiliateOffers lang={lang} placement="preparation" page="home"/>
                <Boards lang={lang} />
                <section
                  className="quick-discovery"
                  aria-label={T("quickFind")}
                >
                  <div className="quick-heading">
                    <h1>{T("quickFind")}</h1>
                    <button
                      className="text-btn"
                      onClick={() =>
                        document.getElementById("planner")?.scrollIntoView({
                          block: "start",
                          behavior: "smooth",
                        })
                      }
                    >
                      {T("planTime")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <form
                    className="quick-search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      explore();
                    }}
                  >
                    <Search size={20} aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={T("search")}
                      aria-label={T("search")}
                      type="search"
                    />
                    <button className="primary" type="submit">
                      {T("findPlaces")}
                    </button>
                  </form>
                  <div className="quick-categories">
                    {["cafe", "food", "experience", "culture", "event"].map(
                      (category) => {
                        const Icon = icons[category]!;
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              setQuery("");
                              explore(category);
                            }}
                          >
                            <Icon size={19} />
                            {T(category)}
                          </button>
                        );
                      },
                    )}
                  </div>
                </section>

                <section
                  hidden
                  className="data-sources"
                  aria-label={
                    visitorText(lang, "공식 데이터 출처", "Official data sources")
                  }
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">OFFICIAL DATA</span>
                      <h2>
                        {visitorText(lang, "공식 관광 데이터", "Official tourism data")}
                      </h2>
                    </div>
                    <span className="muted">
                      {visitorText(lang, "부산에서 전국으로", "Busan to all of Korea")}
                    </span>
                  </div>
                  <div className="source-grid">
                    {openApiSources.slice(0, 6).map((source) => (
                      <a
                        className="source-card"
                        key={source.id}
                        href={source.website || "https://www.data.go.kr/"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>{source.name}</strong>
                        <span>
                          {visitorText(lang, "공식 데이터 출처", "Official data source")}
                        </span>
                      </a>
                    ))}
                  </div>
                </section>

                <PublicListings
                  lang={lang}
                  home
                  onSelect={openListing}
                  regions={catalog.areas}
                />

                <section className="section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">A LITTLE CLOSER TO LOCAL</span>
                      <h2>{T("discover")}</h2>
                      <p>{T("nearby")}</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setQuery("");
                        explore("all", c.areaId);
                      }}
                    >
                      {T("browse")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <DistrictDirectory
                    areas={catalog.areas}
                    lang={lang}
                    onSelect={(id) => {
                      setQuery("");
                      explore("all", id);
                    }}
                  />
                  <div className="places-grid">
                    {catalog.places
                      .filter((p) => p.areaId === c.areaId && !p.sample)
                      .slice(0, 4)
                      .map(placeCard)}
                  </div>
                  {!catalog.places.some(
                    (p) => p.areaId === c.areaId && !p.sample,
                  ) && <p className="notice">{T("districtPreparing")}</p>}
                </section>
                <section className="passport-strip coming-soon-strip">
                  <div className="strip-icon">
                    <BookOpen size={34} />
                  </div>
                  <div>
                    <span className="eyebrow">COMING SOON</span>
                    <h2>
                      {visitorText(lang, "스탬프·굿즈는 준비 중이에요", "Stamps & goods are coming soon")}
                    </h2>
                    <p className="muted">
                      {visitorText(lang, "지금은 부산의 장소와 로컬 콘텐츠를 먼저 만나보세요.", "For now, discover Busan places and local stories first.")}
                    </p>
                  </div>
                </section>
              </div>
            }
            {tab === "ROUTES" && (
              <section className="section routes-page">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">YOUR TRAVEL ROUTE</span>
                    <h1>
                      {visitorText(lang, "나만의 여행코스", "Your travel route")}
                    </h1>
                    <p className="muted">
                      {visitorText(lang, "장소를 선택하고 시간·예산을 맞춘 뒤 코스를 확인하세요.", "Choose your stops, set your time and budget, then review your route.")}
                    </p>
                  </div>
                  <button
                    className="action-link"
                    onClick={() => navigate("TRIP")}
                  >
                    <Bookmark size={16} />
                    {visitorText(lang, "저장한 장소에서 선택", "Choose saved places")}
                  </button>
                </div>
                <ol className="journey-steps">
                  <li>{visitorText(lang, "장소 선택", "Choose places")}</li>
                  <li>{visitorText(lang, "조건 설정", "Set preferences")}</li>
                  <li>
                    {visitorText(lang, "코스 확인·저장", "Review and save")}
                  </li>
                </ol>
                {plannerView}
                {routes !== null && (
                  <section id="results" className="section">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">MADE FOR YOUR NOW</span>
                        <h2>{T("routes")}</h2>
                      </div>
                      <span className="muted">{T("estimated")}</span>
                    </div>
                    {routes.length ? (
                      <div className="route-grid">{routes.map(routeCard)}</div>
                    ) : (
                      <div className="empty">
                        <Compass size={30} />
                        <p>
                          {recommendationMessage(emptyReason, lang)}
                        </p>
                      </div>
                    )}
                  </section>
                )}
                <RouteBenefits lang={lang} hasRoutes={!!routes?.length} />
                <p className="muted">
                  {visitorText(lang, "코스는 이동과 방문을 위한 계획안입니다. 실제 운영시간·요금과 예약 필요 여부는 공식 안내에서 확인해주세요.", "Routes are travel plans. Confirm opening hours, prices and reservations with the official venue.")}
                </p>
              </section>
            )}
            {tab === "ABOUT" && <Boards lang={lang} page />}
            {
              <section
                className="section official-explore"
                style={tab === "MAP" ? undefined : { display: "none" }}
              >
                <h1>{visitorText(lang, "지역별 가이드", "Local guides")}</h1>
                <DistrictDirectory
                  areas={catalog.areas}
                  lang={lang}
                  selected={guideDistrict}
                  onSelect={(id) =>
                    setGuideDistrict(id === guideDistrict ? "" : id)
                  }
                />
                <OfficialPlaces
                  lang={lang}
                  onPlan={openPlanner}
                  onPlanMany={planSaved}
                  districtNames={
                    guideDistrict
                      ? [
                          catalog.areas.find((a) => a.id === guideDistrict)
                            ?.name.ko || "",
                          catalog.areas.find((a) => a.id === guideDistrict)
                            ?.name.en || "",
                        ]
                      : []
                  }
                  onClearDistrict={() => setGuideDistrict("")}
                  regional
                />
              </section>
            }
            {tab === "TRIP" && (
              <section className="section">
                <h1>{visitorText(lang, "저장", "Saved")}</h1>
                <p className="muted">
                  {visitorText(lang, "장소를 모아 코스로 만들거나, 저장한 여행코스를 다시 확인하세요.", "Choose saved places for a new route, or reopen a route you have saved.")}
                </p>
                <SavedPlaces lang={lang} onPlan={planSaved} />
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">YOUR PLANS, IN ONE PLACE</span>
                    <h2>{visitorText(lang, "저장한 코스", "Saved routes")}</h2>
                  </div>
                  <Bookmark size={30} />
                </div>
                <button className="primary" onClick={() => openPlanner()}>
                  {visitorText(lang, "코스", "Routes")}
                </button>
                <p className="notice">
                  {T(
                    status?.session.authenticated
                      ? "savedAccount"
                      : "savedGuest",
                  )}
                </p>
                {wallet.trips.length ? (
                  <div className="route-grid">
                    {wallet.trips.map((v: any, i: number) => (
                      <div key={v.id}>
                        {routeCard(v.data, i)}
                        <button
                          className="text-btn danger"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              await api("trips/delete", { id: v.id });
                              await refresh();
                            })
                          }
                        >
                          <Trash2 size={15} />
                          {T("remove")}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <RouteIcon size={32} />
                    <p>{T("noSaved")}</p>
                    <button className="primary" onClick={() => openPlanner()}>
                      {T("go")}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </section>
            )}
            {tab === "PASS" && (
              <section className="section">
                <span className="eyebrow">NOWRO PASS</span>
                <h1>{visitorText(lang, "혜택·샵", "Offers & shop")}</h1>
                <div className="panel coming-soon-panel">
                  <span className="eyebrow">COMING SOON</span>
                  <h2>
                    {visitorText(lang, "할인권과 굿즈 쇼핑몰을 준비하고 있어요", "Discounts and NOWRO goods are coming soon")}
                  </h2>
                  <p>
                    {visitorText(lang, "초기에는 검증된 부산 여행 정보와 상점 콘텐츠를 무료로 제공합니다.", "We are starting with free, carefully checked Busan travel and local business information.")}
                  </p>
                </div>
                {/* Coupon and shop flows stay below in the source for the next release. */}
                <div hidden>
                  <Shop lang={lang} />
                </div>
                <div hidden>
                  <Shop lang={lang} />
                  <div className="coupon-grid">
                    {catalog.coupons.map((v) => {
                      const held = wallet.vouchers.find(
                        (x: any) => x.coupon_id === v.id,
                      );
                      const p = catalog.places.find((p) => p.id === v.placeId)!;
                      return (
                        <article className="coupon" key={v.id}>
                          <div className="coupon-head">
                            <Ticket size={29} />
                            <span>
                              NOWRO PASS <small>{T("sample")}</small>
                            </span>
                          </div>
                          <h2>{v.benefit[lang]}</h2>
                          <p>
                            {name(p)} / {p.name.ko}
                          </p>
                          <div className="coupon-line" />
                          <dl>
                            <div>
                              <dt>{T("minimum")}</dt>
                              <dd>{krw(v.minimum)}</dd>
                            </div>
                            <div>
                              <dt>{T("valid")}</dt>
                              <dd>
                                {v.from} – {v.until}
                              </dd>
                            </div>
                          </dl>
                          <p className="muted">{v.excluded[lang]}</p>
                          {held ? (
                            <div className="voucher-code">
                              <span className="pill">{T(held.status)}</span>
                              {held.status === "held" && (
                                <>
                                  <small>{T("show")}</small>
                                  <code>{held.id}</code>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              className="primary full"
                              disabled={busy || v.paused}
                              onClick={() =>
                                action(async () => {
                                  await api("coupons/issue", {
                                    couponId: v.id,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              {v.paused ? T("paused") : T("claim")}
                              <Plus size={18} />
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
            {tab === "PASSPORT" && (
              <section className="section">
                <span className="eyebrow">NOWRO PASSPORT</span>
                <h1>{visitorText(lang, "스탬프·보상", "Stamps & rewards")}</h1>
                <div className="panel coming-soon-panel">
                  <span className="eyebrow">COMING SOON</span>
                  <h2>
                    {visitorText(lang, "스탬프 투어와 완주 보상을 준비하고 있어요", "Stamp tours and completion rewards are coming soon")}
                  </h2>
                  <p>
                    {visitorText(lang, "현재는 정보 제공과 장소 탐색에 집중하고 있습니다. 실제 운영이 시작되면 이곳에서 안내해드릴게요.", "We are focusing on discovery first. This page will be updated when the real program launches.")}
                  </p>
                </div>
                <div hidden>
                  <p className="section-intro">{T("stampIntro")}</p>
                  <div className="passport-layout">
                    <div className="passport-book">
                      <div className="book-title">
                        NOWRO <BookOpen size={26} />
                        <span>LOCAL PASSPORT</span>
                      </div>
                      <div className="stamp-grid">
                        {catalog.areas
                          .filter((a) => starterStampAreaIds.includes(a.id))
                          .map((a) => {
                            const count = wallet.stamps.filter(
                              (s: any) =>
                                catalog.places.find((p) => p.id === s.place_id)
                                  ?.areaId === a.id,
                            ).length;
                            return (
                              <div
                                key={a.id}
                                className={`stamp ${count ? "collected" : ""}`}
                              >
                                <Waves size={27} />
                                <strong>{name(a)}</strong>
                                <span>{count ? `${count} ✓` : "○"}</span>
                              </div>
                            );
                          })}
                      </div>
                      <p>YOUR KOREA. RIGHT NOW.</p>
                    </div>
                    <section className="panel">
                      <h2>{T("verify")}</h2>
                      <label>
                        {T("code")}
                        <textarea
                          value={token}
                          maxLength={2000}
                          onChange={(e) => setToken(e.target.value.trim())}
                        />
                      </label>
                      <button
                        className="primary full"
                        disabled={busy || !token}
                        onClick={() =>
                          action(async () => {
                            await api("stamps/claim", { token });
                            setToken("");
                            history.replaceState({}, "", location.pathname);
                            await refresh();
                            setToast(T("success"));
                          })
                        }
                      >
                        {T("verify")}
                        <ShieldCheck size={18} />
                      </button>
                      <p className="muted">{T("sample")}</p>
                      {wallet.stamps.map((s: any) => (
                        <div className="operator-row" key={s.id}>
                          <span>
                            {name(
                              catalog.places.find((p) => p.id === s.place_id)!,
                            )}
                            <small>{s.created.slice(0, 10)}</small>
                          </span>
                          <Check size={18} />
                        </div>
                      ))}
                    </section>
                  </div>
                  <CompletionRewards
                    key={status?.session.email || "guest"}
                    lang={lang}
                    authenticated={!!status?.session.authenticated}
                    version={wallet.stamps.length}
                  />
                </div>
              </section>
            )}
          </>
        )}
        <footer className="footer">
          <p className="footer-notice">{T("banner")}</p>
          <span className="brand small brand-logo">
            <img
              src="/brand/logo.webp"
              alt="NOWRO — Your Korea. Right Now."
              width="746"
              height="182"
              loading="lazy"
            />
          </span>
          <span>
            Your Korea. Right Now.<small>지금, 진짜 한국으로.</small>
          </span>
          <button className="text-btn" onClick={() => setSettings(true)}>
            {T("privacy")}
            <ArrowUpRight size={14} />
          </button>
          {role === "traveler" && (
            <button
              className="text-btn"
              onClick={() => {
                if (status?.operatorPreview) changeRole("partner");
                else {
                  setSettings(true);
                  setToast(
                    visitorText(lang, "상점 로그인은 서버 연결 후 이용할 수 있습니다.", "Shop sign-in will be available after the login server is connected."),
                  );
                }
              }}
            >
              {visitorText(lang, "상점·전문가 모드", "Shop & creator mode")}
              <ArrowUpRight size={14} />
            </button>
          )}
        </footer>
      </main>
      {role === "traveler" && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {tabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{T(`nav${id}`)}</span>
            </button>
          ))}
        </nav>
      )}
      {listing && (
        <Modal
          title={lang === "ko" ? listing.data.titleKo : listing.data.titleEn}
          close={closeListing}
          historyQuery={{ key: "listing", value: listing.id }}
        >
          <ListingDetail
            data={listing.data}
            lang={lang}
            related={allListings
              .filter(
                (item) =>
                  item.id !== listing.id &&
                  item.data.areaId === listing.data.areaId &&
                  item.status === "published",
              )
              .slice(0, 8)}
            onSelectRelated={setListing}
          />
          <button
            className="text-btn"
            onClick={() =>
              navigator.clipboard
                .writeText(location.href)
                .then(() => setToast(T("success")))
                .catch(() => setToast(T("error")))
            }
          >
            <Copy size={16} />
            {visitorText(lang, "상세페이지 링크 복사", "Copy detail link")}
          </button>
        </Modal>
      )}
      {selected && (
        <Modal title={T("view")} close={() => setSelected(null)}>
          <p className="notice">
            {selected.sample
              ? T("sample")
              : visitorText(lang, "계획용 예상 코스 · 영업시간·요금·예약 여부 미확인", "Planning estimate · hours, fees and reservations are unverified")}{" "}
            · {T("estimated")}
          </p>
          <div className="detail-metrics">
            <b>{selected.minutes} min</b>
            <b>
              {krw(selected.costMin)} – {krw(selected.costMax)}
            </b>
            <span>
              {clock(selected.startAt)} → {clock(selected.endAt)}
            </span>
          </div>
          <p className="muted">{T("costNote")}</p>
          <div className="timeline">
            {selected.stops.map((s, i) => {
              const p = catalog.places.find((p) => p.id === s.placeId)!;
              if (!p) return <p key={s.placeId} className="muted">{lang === 'ko' ? '장소 정보 재확인이 필요합니다. 코스를 다시 만들어주세요.' : 'This place needs rechecking. Please rebuild your route.'}</p>;
              return (
                <div className="timeline-stop" key={s.placeId}>
                  <span className="stop-number">{i + 1}</span>
                  <div className="timeline-body">
                    <small>
                      {T("travel")} {s.travel} min · {clock(s.arrival)}–
                      {clock(s.departure)}
                    </small>
                    <button className="title-link" onClick={() => openPlace(p)}>
                      {name(p)}
                      <ArrowUpRight size={15} />
                    </button>
                    <p>
                      {p.name.ko} · {T("stay")} {s.stay} min + {s.wait} min ·{" "}
                      {krw(s.costMax)}
                    </p>
                    <AffiliateOffers lang={lang} placeIds={[p.id]} page="route"/>
                    <div className="stop-actions">
                      <select
                        aria-label={T("replace")}
                        disabled={busy}
                        value={p.id}
                        onChange={(e) => {
                          const ids = selected.stops.map((s) => s.placeId);
                          ids[i] = e.target.value;
                          changeRoute(ids);
                        }}
                      >
                        {catalog.places
                          .filter(
                            (x) =>
                              x.published && distance(selected.conditions.origin, x.point) < (selected.conditions.transport === "walk" ? 3 : 8) &&
                              (!selected.stops.some(
                                (s) => s.placeId === x.id,
                              ) ||
                                x.id === p.id),
                          )
                          .map((x) => (
                            <option value={x.id} key={x.id}>
                              {name(x)}
                            </option>
                          ))}
                      </select>
                      <button
                        aria-label={T("remove")}
                        className="icon-btn"
                        disabled={busy || selected.stops.length === 1}
                        onClick={() =>
                          changeRoute(
                            selected.stops
                              .filter((x) => x.placeId !== p.id)
                              .map((x) => x.placeId),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        aria-label={T("move")}
                        className="icon-btn"
                        disabled={busy || i === 0}
                        onClick={() => {
                          const ids = selected.stops.map((s) => s.placeId);
                          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                          changeRoute(ids);
                        }}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <a
                        className="icon-btn"
                        aria-label={T("directions")}
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.point.lat},${p.point.lng}&travelmode=${selected.conditions.transport === "walk" ? "walking" : selected.conditions.transport === "car" ? "driving" : "transit"}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="notice">
            {T("back")} {selected.returnMinutes} min · {T("buffer")}{" "}
            {selected.buffer} min
          </p>
          <AffiliateOffers lang={lang} placeIds={selected.stops.map(stop=>stop.placeId)} placement="stay" page="route"/>
          <RouteShare route={selected} places={catalog.places} lang={lang}/>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                const next = {
                  ...selected.conditions,
                  origin: c.origin,
                  startAt: new Date().toISOString(),
                  minutes: Math.max(30, selected.conditions.minutes - 30),
                };
                setC(next);
                setSelected(null);
                generate(next);
              }}
            >
              <RefreshCw size={16} />
              {T("shorten")}
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api("trips", {
                    placeIds: selected.stops.map((s) => s.placeId),
                    conditions: selected.conditions,
                  });
                  track('save_route');
                  await refresh();
                  setToast(T("saved"));
                })
              }
            >
              {T("save")}
              <Bookmark size={17} />
            </button>
          </div>
        </Modal>
      )}
      {place && (
        <Modal title={name(place)} close={() => setPlace(null)}>
          {art(place)}
          <p className="media-caption">
            {placeMedia(place).generated ? (
              T("representativeImage")
            ) : (
              <>
                {placeMedia(place).alt} ·{" "}
                <a
                  href={placeMedia(place).source}
                  target="_blank"
                  rel="noreferrer"
                >
                  {placeMedia(place).credit}
                </a>{" "}
                ·{" "}
                <a
                  href={placeMedia(place).licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {placeMedia(place).license}
                </a>
                <br />
                {T("photoChanges")}
              </>
            )}
          </p>
          {place.sample && <span className="sample-label">{T("sample")}</span>}
          <p>{place.name.ko}</p><PlaceMaps item={place} lang={lang} />
          <LocalizedDescription text={place.description[lang]} lang={lang}/>
          <AffiliateOffers lang={lang} placeIds={[place.id]}/>
          <dl className="place-details">
            <div>
              <dt>{T("address")}</dt>
              <dd>
                {place.address}
                <button
                  className="text-btn"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(place.address)
                      .then(() => setToast(T("success")))
                      .catch(() => setToast(T("error")))
                  }
                >
                  <Copy size={13} />
                  {T("copy")}
                </button>
              </dd>
            </div>
            <div>
              <dt>{T("budget")}</dt>
              <dd>
                {krw(place.costMin)}–{krw(place.costMax)}
              </dd>
            </div>
            <div>
              <dt>{T("stay")}</dt>
              <dd>{place.stay} min</dd>
            </div>
            <div>
              <dt>{T("hours")}</dt>
              <dd>
                09:00–22:00 · {T("sample")}
                <br />
                {T("unknown")}
              </dd>
            </div>
            <div>
              <dt>
                {T("accessible")} / {T("diet")}
              </dt>
              <dd>{T("unknown")}</dd>
            </div>
            <div>
              <dt>{T("source")}</dt>
              <dd>
                {place.source}
                <br />
                {place.checkedAt || T("unknown")}
              </dd>
            </div>
          </dl>
          {place.reservation && <p className="notice">{T("reservation")}</p>}
          <div className="modal-actions">
            <button className="secondary" onClick={() => setReport(!report)}>
              {T("report")}
            </button>
            <a
              className="primary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.point.lat},${place.point.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {T("directions")}
              <Navigation size={17} />
            </a>
          </div>
          {report && (
            <div className="report">
              <textarea
                aria-label={T("report")}
                value={reportText}
                maxLength={500}
                onChange={(e) => setReportText(e.target.value)}
              />
              <button
                className="secondary"
                disabled={busy || reportText.length < 3}
                onClick={() =>
                  action(async () => {
                    await api("report", {
                      placeId: place.id,
                      reason: reportText,
                    });
                    setReportText("");
                    setReport(false);
                    setToast(T("success"));
                  })
                }
              >
                {T("report")}
              </button>
            </div>
          )}
        </Modal>
      )}
      {settings && (
        <Modal title={T("settings")} close={() => setSettings(false)}>
          <Account lang={lang} status={status} onChange={refresh} />
          {status?.session.role !== "admin" && (
            <BusinessApplicationPanel
              key={status?.session.email || "guest"}
              lang={lang}
              status={status}
              areas={catalog.areas}
              onOpenStudio={async () => {
                const current = await refresh();
                if (current.session.role !== "partner")
                  throw new Error("BUSINESS_NOT_APPROVED");
                setRole("partner");
                setSettings(false);
              }}
            />
          )}
          <label>
            {T("language")}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
            >
              {languages.map((l, i) => (
                <option key={l} value={l}>
                  {names[i]}
                </option>
              ))}
            </select>
          </label>
          <h3>{T("privacy")}</h3>
          <p className="muted">{T("privacyText")}</p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent.location}
              onChange={(e) => {
                const next = { ...consent, location: e.target.checked };
                action(async () => {
                  await api("consent", next);
                  setConsent(next);
                  if (!next.location)
                    setC((old) => ({
                      ...old,
                      origin: area!.point,
                      returnPoint: null,
                      deadline: null,
                    }));
                });
              }}
            />
            {T("locationConsent")}
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent.analytics}
              onChange={(e) => {
                const next = { ...consent, analytics: e.target.checked };
                action(async () => {
                  await api("consent", next);
                  setConsent(next);
                });
              }}
            />
            {T("analytics")}
          </label>
          <p className="notice">{T("aiOff")}</p>
          {status?.operatorPreview && (
            <>
              <h3>{T("operators")}</h3>
              <p className="muted">{T("operatorNote")}</p>
              <div className="inline">
                {["traveler", "partner", "admin"].map((r) => (
                  <button
                    className="secondary"
                    disabled={busy}
                    key={r}
                    onClick={() => changeRole(r)}
                  >
                    {T(r)}
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-btn"
            aria-label={T("close")}
            onClick={() => setToast("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </>
  );
}
