import { useState, useEffect, useRef, lazy, Suspense } from "react";
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
import type { Listing } from "../shared/listings.ts";
const LiveMap = lazy(() => import("./MapView"));
type Tab = "NOW" | "MAP" | "TRIP" | "PASS" | "PASSPORT";
const tabs = [
  { id: "NOW" as Tab, icon: Compass },
  { id: "MAP" as Tab, icon: Map },
  { id: "TRIP" as Tab, icon: RouteIcon },
  { id: "PASS" as Tab, icon: Ticket },
  { id: "PASSPORT" as Tab, icon: BookOpen },
];
const icons: Record<string, typeof Waves> = {
  sea: Waves,
  cafe: Coffee,
  food: Utensils,
  culture: Palette,
  shopping: ShoppingBag,
  experience: Sparkles,
  wellness: Leaf,
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
const koreaInput = (iso: string) =>
  new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 16);
const koreaISO = (value: string) => new Date(value + ":00+09:00").toISOString();
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
  const [listing, setListing] = useState<Listing | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("listing");
    if (id)
      api("listings")
        .then((v) =>
          setListing(v.listings.find((x: Listing) => x.id === id) ?? null),
        )
        .catch(() => {});
  }, []);
  function openListing(v: Listing) {
    setListing(v);
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
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);
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
        lang === "ko"
          ? "결제 확인 스탬프가 등록되었습니다."
          : "Paid-visit stamp registered.",
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
      analytics: !!nextConsent.analytics,
      location: !!nextConsent.location,
    });
    return st;
  };
  useEffect(() => {
    refresh().catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("nowro-language", lang);
    } catch {}
  }, [lang]);
  useEffect(() => {
    try {
      sessionStorage.setItem("nowro-conditions", JSON.stringify(c));
    } catch {}
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
          code === "INFEASIBLE_ROUTE"
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
    setC((old) => ({ ...old, [key]: v }));
  }
  function areaChange(id: string) {
    const a = catalog?.areas.find((a) => a.id === id);
    if (a) setC((old) => ({ ...old, areaId: id, origin: a.point }));
  }
  async function generate(conditions = c) {
    await action(async () => {
      const data = await api("recommend", { conditions });
      setRoutes(data.routes);
      setTab("NOW");
      api("events", { name: "recommend" }).catch(() => {});
      setTimeout(
        () =>
          document
            .getElementById("results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    });
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
        <span className="sample-label">{T("sample")}</span>
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
          .map((s) => name(catalog!.places.find((p) => p.id === s.placeId)!))
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
        {T("sample")}
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
  return (
    <>
      <EmailLinkSignIn lang={lang} onChange={refresh} />
      <div className="preview-banner">
        <ShieldCheck size={14} />
        {T("banner")}
      </div>
      <header className="topbar">
        <button
          className="brand brand-logo"
          aria-label={`NOWRO Korea · ${T("navNOW")}`}
          onClick={() => {
            navigate("NOW");
            setRole(status?.session.role || "traveler");
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
            {tabs.map(({ id }) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => navigate(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                {T(`nav${id}`)}
                {tab === id && <span />}
              </button>
            ))}
          </nav>
        )}
        <div className="top-actions">
          <span className="city">
            <MapPin size={15} />
            {name(catalog.cities[0])}
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
                  NOWRO {role === "admin" ? "ADMIN" : "PARTNER"}
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
                ? lang === "ko"
                  ? "로그인한 운영 계정입니다. 업체 승인과 상품 게시 심사는 별도로 진행됩니다."
                  : "Signed-in operator account. Business approval and listing publication are reviewed separately."
                : T("operatorNote")}
            </p>
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
                      {lang === "ko"
                        ? "결제 확인 → 현장 QR 발급 → 고객 스캔 → 서버 스탬프 등록. 실제 결제 연동 전에는 로컬 테스트만 가능합니다."
                        : "Payment confirmation → on-site QR → customer scan → server stamp. Local testing only until payments are connected."}
                    </p>
                    {status?.operatorPreview && (
                      <>
                        <label>
                          {lang === "ko"
                            ? "테스트 결제 참조번호"
                            : "Test receipt reference"}
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
                          {lang === "ko"
                            ? "결제 금액 (KRW)"
                            : "Payment amount (KRW)"}
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
                            ? lang === "ko"
                              ? "테스트 결제 확인됨"
                              : "Test payment confirmed"
                            : lang === "ko"
                              ? "테스트 결제 확인"
                              : "Confirm test payment"}
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
            {tab === "NOW" && (
              <>
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
                    {["cafe", "food", "experience", "sea"].map((category) => {
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
                    })}
                  </div>
                </section>
                <section className="hero">
                  <div className="hero-copy">
                    <span className="eyebrow">
                      <span className="status-dot" />
                      YOUR KOREA. RIGHT NOW.
                    </span>
                    <h2>{T("hero")}</h2>
                    <p>{T("intro")}</p>
                    <div className="hero-tags">
                      <span>
                        <Users size={15} />
                        {T("everyone")}
                      </span>
                      <span>
                        <Footprints size={15} />
                        {T("walk")}
                      </span>
                      <span>
                        <Ticket size={15} />
                        NOWRO Pass
                      </span>
                    </div>
                    <div className="hero-foot">
                      <span>01 — BUSAN, KOREA</span>
                      <ArrowUpRight size={28} />
                    </div>
                  </div>
                  <div className="hero-image">
                    <img
                      src={scenery.gwangalli!.src}
                      alt={scenery.gwangalli!.alt}
                      fetchPriority="high"
                    />
                    <div className="image-label">
                      <span>
                        <MapPin size={14} />
                        {name(catalog.areas.find((a) => a.id === "gwangalli")!)}
                        , {name(catalog.cities[0])}
                      </span>
                      <small>
                        <a
                          href={scenery.gwangalli!.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Photo: Masterhatch
                        </a>{" "}
                        ·{" "}
                        <a
                          href={scenery.gwangalli!.licenseUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          CC BY-SA 4.0
                        </a>
                        <br />
                        {T("photoChanges")}
                      </small>
                    </div>
                    <div className="image-note">
                      GO LOCAL.
                      <br />
                      FEEL MORE.<span>↗</span>
                    </div>
                  </div>
                </section>
                <section
                  id="planner"
                  className="planner"
                  aria-label={T("plan")}
                >
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
                              {lang === "ko"
                                ? a.name.ko
                                : `${name(a)} / ${a.name.ko}`}
                            </option>
                          ))}
                        </select>
                        {area && (
                          <small className="muted">{area.aliases[lang]}</small>
                        )}
                        {!catalog.places.some((p) => p.areaId === c.areaId) && (
                          <p className="notice">{T("districtPreparing")}</p>
                        )}
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
                            onChange={(e) =>
                              update("minutes", Number(e.target.value))
                            }
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
                            onChange={(e) =>
                              update("budget", Number(e.target.value))
                            }
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
                              className={
                                c.interests.includes(id) ? "chosen" : ""
                              }
                              onClick={() => toggleInterest(id)}
                            >
                              <Icon size={15} />
                              {T(id)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button className="primary main-cta" disabled={busy}>
                        {busy ? T("loading") : T("go")}
                        <ArrowUpRight size={21} />
                      </button>
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
                            onChange={(e) =>
                              update("companion", e.target.value)
                            }
                          >
                            {["solo", "couple", "friends", "family"].map(
                              (x) => (
                                <option key={x} value={x}>
                                  {T(x)}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label>
                          {T("transport")}
                          <select
                            value={c.transport}
                            onChange={(e) =>
                              update(
                                "transport",
                                e.target.value as Conditions["transport"],
                              )
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
                          {T("startAt")}
                          <input
                            type="datetime-local"
                            required
                            value={koreaInput(c.startAt)}
                            onChange={(e) => {
                              if (e.target.value)
                                update("startAt", koreaISO(e.target.value));
                            }}
                          />
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
                            <option value="vegetarian">
                              Vegetarian / 채식
                            </option>
                            <option value="halal">Halal / 할랄</option>
                          </select>
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={c.children}
                            onChange={(e) =>
                              update("children", e.target.checked)
                            }
                          />
                          {T("children")}
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={c.accessible}
                            onChange={(e) =>
                              update("accessible", e.target.checked)
                            }
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
                                    e.target.value
                                      ? koreaISO(e.target.value)
                                      : null,
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
                              onChange={(e) =>
                                update("tripStart", e.target.value)
                              }
                            />
                            <input
                              aria-label="Trip end"
                              type="date"
                              min={c.tripStart}
                              value={c.tripEnd}
                              onChange={(e) =>
                                update("tripEnd", e.target.value)
                              }
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
                          {extracted.areaId || c.areaId} ·{" "}
                          {extracted.minutes ?? c.minutes} min ·{" "}
                          {krw(extracted.budget ?? c.budget)} ·{" "}
                          {extracted.interests
                            .map((x: string) => T(x))
                            .join(", ")}
                        </p>
                        <button
                          className="secondary"
                          onClick={() => {
                            setC((old) => ({
                              ...old,
                              areaId: extracted.areaId || old.areaId,
                              origin:
                                catalog.areas.find(
                                  (a) => a.id === extracted.areaId,
                                )?.point || old.origin,
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
                <PublicListings
                  lang={lang}
                  home
                  onSelect={openListing}
                  regions={catalog.areas}
                />
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
                          {!catalog.places.some((p) => p.areaId === c.areaId)
                            ? T("districtPreparing")
                            : T("empty")}
                        </p>
                      </div>
                    )}
                  </section>
                )}
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
                      .filter((p) => p.areaId === c.areaId)
                      .slice(0, 4)
                      .map(placeCard)}
                  </div>
                  {!catalog.places.some((p) => p.areaId === c.areaId) && (
                    <p className="notice">{T("districtPreparing")}</p>
                  )}
                </section>
                <section className="passport-strip">
                  <div className="strip-icon">
                    <BookOpen size={34} />
                  </div>
                  <div>
                    <span className="eyebrow">NOWRO PASSPORT</span>
                    <h2>{T("passport")}</h2>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => navigate("PASSPORT")}
                  >
                    PASSPORT
                    <ArrowUpRight size={17} />
                  </button>
                </section>
              </>
            )}
            {tab === "MAP" && (
              <section className="section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">YOUR LOCAL COMPASS</span>
                    <h1>{T("map")}</h1>
                  </div>
                  <div className="segmented">
                    <button
                      className={!mapView ? "active" : ""}
                      onClick={() => setMapView(false)}
                      aria-pressed={!mapView}
                    >
                      {T("list")}
                    </button>
                    <button
                      className={mapView ? "active" : ""}
                      onClick={() => setMapView(true)}
                      aria-pressed={mapView}
                    >
                      {T("mapView")}
                    </button>
                  </div>
                </div>
                <div className="map-controls">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={T("search")}
                    aria-label={T("search")}
                  />
                  <select
                    value={browseArea}
                    onChange={(e) => setBrowseArea(e.target.value)}
                    aria-label={T("where")}
                  >
                    <option value="all">{T("allAreas")}</option>
                    {catalog.areas.map((a) => (
                      <option value={a.id} key={a.id}>
                        {name(a)}
                      </option>
                    ))}
                  </select>
                </div>
                <DistrictDirectory
                  areas={catalog.areas}
                  lang={lang}
                  selected={browseArea}
                  onSelect={(id) => {
                    setBrowseArea(id);
                    setQuery("");
                    setFilter("all");
                  }}
                />
                <div className="interest-chips filters">
                  {["all", ...Object.keys(icons)].map((x) => (
                    <button
                      aria-pressed={filter === x}
                      className={filter === x ? "chosen" : ""}
                      onClick={() => setFilter(x)}
                      key={x}
                    >
                      {T(x)}
                    </button>
                  ))}
                </div>
                {mapView && (
                  <div className="map-panel">
                    <Suspense
                      fallback={<p className="notice">{T("loading")}</p>}
                    >
                      <LiveMap
                        origin={mapOrigin}
                        originLabel={
                          browseArea === "all"
                            ? T("where")
                            : name(
                                catalog.areas.find((a) => a.id === browseArea)!,
                              )
                        }
                        places={matchingPlaces}
                        lang={lang}
                        onSelect={openPlace}
                      />
                    </Suspense>
                    <p>
                      {T("mapNote")}{" "}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${mapOrigin.lat}&mlon=${mapOrigin.lng}#map=15/${mapOrigin.lat}/${mapOrigin.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        OpenStreetMap ↗
                      </a>
                    </p>
                  </div>
                )}
                <div className="search-status">
                  <p role="status" aria-live="polite">
                    {matchingPlaces.length} {T("placeResults")} ·{" "}
                    {browseArea === "all"
                      ? T("allAreas")
                      : name(
                          catalog.areas.find((a) => a.id === browseArea)!,
                        )}{" "}
                    · {T(filter)}
                  </p>
                  <button
                    className="text-btn"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                      setBrowseArea("all");
                    }}
                  >
                    {T("resetSearch")}
                  </button>
                </div>
                {matchingPlaces.length ? (
                  <div className="places-grid">
                    {matchingPlaces.map(placeCard)}
                  </div>
                ) : (
                  <div className="empty">
                    <Search size={28} />
                    <h2>{T("noPlaces")}</h2>
                    <p>
                      {browseArea !== "all" &&
                      !catalog.places.some((p) => p.areaId === browseArea)
                        ? T("districtPreparing")
                        : T("noPlacesHint")}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                        setBrowseArea("all");
                      }}
                    >
                      {T("resetSearch")}
                    </button>
                  </div>
                )}
                <PublicListings
                  regions={catalog.areas}
                  lang={lang}
                  onSelect={openListing}
                  query={query}
                  area={browseArea}
                  category={filter}
                />
              </section>
            )}
            {tab === "TRIP" && (
              <section className="section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">YOUR PLANS, IN ONE PLACE</span>
                    <h1>TRIP</h1>
                  </div>
                  <Bookmark size={30} />
                </div>
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
                    <button className="primary" onClick={() => setTab("NOW")}>
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
                <h1>{T("pass")}</h1>
                <p className="section-intro">{T("passIntro")}</p>
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
                                await api("coupons/issue", { couponId: v.id });
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
              </section>
            )}
            {tab === "PASSPORT" && (
              <section className="section">
                <span className="eyebrow">NOWRO PASSPORT</span>
                <h1>{T("passport")}</h1>
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
              </section>
            )}
          </>
        )}
        <footer className="footer">
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
                    lang === "ko"
                      ? "상점 로그인은 서버 연결 후 이용할 수 있습니다."
                      : "Shop sign-in will be available after the login server is connected.",
                  );
                }
              }}
            >
              {lang === "ko" ? "상점·전문가 모드" : "Shop & creator mode"}
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
          <ListingDetail data={listing.data} lang={lang} />
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
            {lang === "ko" ? "상세페이지 링크 복사" : "Copy detail link"}
          </button>
        </Modal>
      )}
      {selected && (
        <Modal title={T("view")} close={() => setSelected(null)}>
          <p className="notice">
            {T("sample")} · {T("estimated")}
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
                              x.areaId === selected.conditions.areaId &&
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
          <span className="sample-label">{T("sample")}</span>
          <p>{place.name.ko}</p>
          <p>{place.description[lang]}</p>
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
