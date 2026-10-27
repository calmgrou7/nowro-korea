import { useEffect, useState } from "react";
import type { Area, Lang } from "../shared/types.ts";
import type { Listing, ListingData } from "../shared/listings.ts";
import { api } from "./api";
const money = (v: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(v);
const text = (
  d: ListingData,
  lang: Lang,
  key: "title" | "summary" | "description",
) => d[`${key}${lang === "ko" ? "Ko" : "En"}`] || d[`${key}Ko`];
const empty = (areaId: string): ListingData => ({
  kind: "shop",
  category: "cafe",
  areaId,
  businessName: "",
  titleKo: "",
  titleEn: "",
  summaryKo: "",
  summaryEn: "",
  descriptionKo: "",
  descriptionEn: "",
  address: "",
  contact: "",
  bookingUrl: "",
  priceMin: 0,
  priceMax: 0,
  duration: 30,
  hours: "",
  inclusions: "",
  exclusions: "",
  cancellation: "",
  promotion: "",
  eventStart: "",
  eventEnd: "",
  images: [],
  imageRights: false,
});

export function ListingDetail({
  data: d,
  lang,
}: {
  data: ListingData;
  lang: Lang;
}) {
  const L = (en: string, ko: string) => (lang === "ko" ? ko : en);
  return (
    <article className="listing-detail">
      {!!d.images.length && (
        <div className="listing-gallery">
          {d.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${text(d, lang, "title")} ${i + 1}`}
              loading="lazy"
            />
          ))}
        </div>
      )}
      <span className="eyebrow">{d.businessName}</span>
      <h2>{text(d, lang, "title") || L("Untitled listing", "등록 제목")}</h2>
      <p>{text(d, lang, "summary")}</p>
      <div className="listing-facts">
        <b>
          {money(d.priceMin)} – {money(d.priceMax)}
        </b>
        <span>
          {d.duration} {L("min", "분")}
        </span>
      </div>
      <p className="notice">
        {L(
          "Information supplied by the provider. Confirm opening hours, price and availability before visiting.",
          "업체가 제공한 정보입니다. 방문 전 운영시간·가격·예약 가능 여부를 확인하세요.",
        )}
      </p>
      {d.promotion && <p className="listing-promo">{d.promotion}</p>}
      <div className="listing-description">{text(d, lang, "description")}</div>
      <dl className="place-details">
        {[
          [L("Address", "주소"), d.address],
          [L("Contact", "문의"), d.contact],
          [L("Hours / availability", "운영·이용 안내"), d.hours],
          [L("Included", "포함 사항"), d.inclusions],
          [L("Not included", "불포함 사항"), d.exclusions],
          [L("Cancellation / refund", "취소·환불 정책"), d.cancellation],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="listing-description">{value}</dd>
            </div>
          ))}
      </dl>
      <div className="listing-actions">
        {d.address && (
          <a
            className="secondary"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`}
            target="_blank"
            rel="noreferrer"
          >
            {L("Open map", "지도 보기")} ↗
          </a>
        )}
        {d.bookingUrl && (
          <a
            className="primary"
            href={d.bookingUrl}
            target="_blank"
            rel="noreferrer"
          >
            {L("Booking / official page", "예약·공식 페이지")} ↗
          </a>
        )}
      </div>
    </article>
  );
}

export function PublicListings({
  lang,
  onSelect,
  query = "",
  area = "all",
  category = "all",
  home = false,
  regions,
}: {
  lang: Lang;
  onSelect: (v: Listing) => void;
  query?: string;
  area?: string;
  category?: string;
  home?: boolean;
  regions: Area[];
}) {
  const [items, setItems] = useState<Listing[]>([]),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api("listings")
      .then((v) => {
        if (active) setItems(v.listings);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const L = (en: string, ko: string) => (lang === "ko" ? ko : en);
  const found = items.filter((v) => {
    const d = v.data;
    const hay = [
      d.titleKo,
      d.titleEn,
      d.summaryKo,
      d.summaryEn,
      d.businessName,
      d.address,
      d.areaId,
      d.category,
      ...Object.values(regions.find((a) => a.id === d.areaId)?.name ?? {}),
      ...Object.values(regions.find((a) => a.id === d.areaId)?.aliases ?? {}),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (area === "all" || d.areaId === area) &&
      (category === "all" || d.category === category) &&
      (!d.eventEnd || d.eventEnd >= new Date().toISOString().slice(0, 10)) &&
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((word) => hay.includes(word))
    );
  });
  if (!items.length && !failed) return null;
  return (
    <section className="section provider-listings">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOCAL PROVIDERS</span>
          <h2>
            {home
              ? L(
                  "From local shops & creators",
                  "상점과 크리에이터의 새로운 소식",
                )
              : L("Products, experiences & places", "상품·체험·관광 콘텐츠")}
          </h2>
          <p>
            {L(
              "Provider listings · reviewed for publication",
              "업체 등록 콘텐츠 · 게시 승인 완료",
            )}
          </p>
        </div>
      </div>
      {failed ? (
        <p className="notice">
          {L(
            "Unable to load provider listings. Please reload.",
            "업체 등록 콘텐츠를 불러오지 못했습니다. 새로고침해 주세요.",
          )}
        </p>
      ) : !found.length ? (
        <p className="notice">
          {L(
            "No provider listings match these filters.",
            "현재 조건에 맞는 업체 등록 콘텐츠가 없습니다.",
          )}
        </p>
      ) : (
        <div className="places-grid">
          {(home ? found.slice(0, 4) : found).map((v) => (
            <button
              className="place-card"
              key={v.id}
              onClick={() => onSelect(v)}
            >
              <div className="place-art">
                <img
                  src={v.data.images[0]}
                  alt={text(v.data, lang, "title")}
                  loading="lazy"
                />
                <span>{L("Provider listing", "업체 등록")}</span>
              </div>
              <div className="card-copy">
                <span className="eyebrow">{v.data.businessName}</span>
                <h3>{text(v.data, lang, "title")}</h3>
                <p>
                  {money(v.data.priceMin)} – {money(v.data.priceMax)}
                </p>
                <p>{text(v.data, lang, "summary")}</p>
                {v.data.promotion && (
                  <span className="listing-promo">{v.data.promotion}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function MerchantListings({
  lang,
  role,
  areas,
  business,
}: {
  lang: Lang;
  role: string;
  areas: Area[];
  business?: { businessName: string; areaId: string; address: string } | null;
}) {
  const L = (en: string, ko: string) => (lang === "ko" ? ko : en);
  const [items, setItems] = useState<Listing[]>([]),
    [data, setData] = useState<ListingData>(() => empty(areas[0]!.id)),
    [id, setId] = useState<string>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(false),
    [note, setNote] = useState("");
  const load = async () => setItems((await api("operator/listings")).listings);
  useEffect(() => {
    if (business && !id)
      setData((old) => ({
        ...old,
        businessName: business.businessName,
        areaId: business.areaId,
        address: business.address,
      }));
  }, [business?.businessName, business?.areaId, business?.address, id]);
  useEffect(() => {
    load().catch(() =>
      setMessage(
        L("Unable to load listings.", "등록 목록을 불러오지 못했습니다."),
      ),
    );
  }, [role]);
  function update<K extends keyof ListingData>(key: K, value: ListingData[K]) {
    setData((old) => ({ ...old, [key]: value }));
  }
  async function save(submit: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const v = await api("operator/listings/save", { id, data, submit });
      setId(v.id);
      await load();
      setMessage(
        submit
          ? L(
              "Submitted for review. It appears on Home and Explore after approval.",
              "게시 요청 완료. 관리자 승인 후 메인과 탐색에 노출됩니다.",
            )
          : L("Draft saved on the server.", "서버에 임시저장했습니다."),
      );
    } catch {
      setMessage(
        L(
          "Unable to save. Check required fields, price range and image rights, then try again.",
          "저장하지 못했습니다. 필수 항목·가격 범위·이미지 권리를 확인한 뒤 다시 시도하세요.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function review(v: Listing, approved: boolean) {
    setBusy(true);
    try {
      await api("operator/listings/review", { id: v.id, approved, note });
      await load();
      setMessage(L("Review saved.", "심사 결과를 저장했습니다."));
    } catch {
      setMessage(
        L(
          "Review failed. Reload and retry.",
          "심사 처리 실패. 새로고침 후 다시 시도하세요.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    draft: L("Draft", "임시저장"),
    pending: L("Review requested", "승인 대기"),
    published: L("Published", "게시 중"),
    rejected: L("Changes requested", "수정 요청"),
    archived: L("Archived", "보관·노출 중지"),
  };
  const field = (
    key: keyof ListingData,
    label: string,
    required = false,
    multiline = false,
  ) => (
    <label key={key}>
      {label}
      {required ? " *" : ""}
      {multiline ? (
        <textarea
          value={String(data[key])}
          required={required}
          maxLength={key.startsWith("description") ? 6000 : 1000}
          onChange={(e) => update(key, e.target.value as never)}
          rows={key.startsWith("description") ? 6 : 3}
        />
      ) : (
        <input
          value={String(data[key])}
          readOnly={key === "businessName" && !!business}
          required={required}
          maxLength={1000}
          onChange={(e) => update(key, e.target.value as never)}
        />
      )}
    </label>
  );
  return (
    <section className="merchant-listings panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SHOP & CREATOR STUDIO</span>
          <h2>
            {L("Register products & services", "상품·서비스·관광 콘텐츠 등록")}
          </h2>
          <p>
            {L(
              "Save a draft, preview the detail page, then request publication.",
              "임시저장하고 상세페이지를 미리 본 뒤 게시를 요청하세요.",
            )}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setData(
              business
                ? {
                    ...empty(business.areaId),
                    businessName: business.businessName,
                    address: business.address,
                  }
                : empty(areas[0]!.id),
            );
            setId(undefined);
            setPreview(false);
            setMessage("");
          }}
        >
          {L("New listing", "새로 등록")}
        </button>
      </div>
      <p className="notice">
        {L(
          "Editing a published listing removes it from public view until it is approved again. Fields marked * are required for publication.",
          "게시 중인 내용을 수정·저장하면 재승인 전까지 노출이 중단됩니다. *는 게시 요청 시 필수입니다.",
        )}
      </p>
      <div className="merchant-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <fieldset disabled={busy}>
            <legend>{L("1. Basic information", "1. 기본 정보")}</legend>
            <div className="listing-form-grid">
              <label>
                {L("Listing type", "등록 유형")}
                <select
                  value={data.kind}
                  onChange={(e) =>
                    update("kind", e.target.value as ListingData["kind"])
                  }
                >
                  {[
                    ["shop", "Shop / product", "상점·상품"],
                    ["service", "Service", "서비스"],
                    ["experience", "Experience", "체험"],
                    ["attraction", "Attraction", "관광지"],
                    ["content", "Content", "콘텐츠"],
                    ["event", "Local event", "지역 행사"],
                  ].map(([key, en, ko]) => (
                    <option key={key} value={key}>
                      {L(en!, ko!)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {L("Area", "지역")}
                <select
                  value={data.areaId}
                  disabled={!!business}
                  onChange={(e) => update("areaId", e.target.value)}
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name[lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {L("Category", "카테고리")}
                <select
                  value={data.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  {[
                    ["cafe", "Coffee", "카페"],
                    ["food", "Food", "식당·음식"],
                    ["experience", "Experience", "체험"],
                    ["sea", "Ocean", "바다"],
                    ["culture", "Culture", "문화"],
                    ["event", "Local event", "지역 행사"],
                    ["shopping", "Shopping", "쇼핑"],
                    ["wellness", "Wellness", "웰니스"],
                  ].map(([key, en, ko]) => (
                    <option key={key} value={key}>
                      {L(en!, ko!)}
                    </option>
                  ))}
                </select>
              </label>
              {field(
                "businessName",
                L("Shop / provider name", "상점·운영자 이름"),
                true,
              )}
              {field(
                "titleKo",
                L("Title · Korean", "상품·서비스명 · 한국어"),
                true,
              )}
              {field(
                "titleEn",
                L("Title · English", "상품·서비스명 · 영어"),
                true,
              )}
              {field(
                "summaryKo",
                L("Short introduction · Korean", "한 줄 소개 · 한국어"),
                true,
              )}
              {field(
                "summaryEn",
                L("Short introduction · English", "한 줄 소개 · 영어"),
                true,
              )}
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>{L("2. Detail page", "2. 상세페이지 내용")}</legend>
            {field(
              "descriptionKo",
              L("Full description · Korean", "상세 설명 · 한국어"),
              true,
              true,
            )}
            {field(
              "descriptionEn",
              L("Full description · English", "상세 설명 · 영어"),
              true,
              true,
            )}
            <label>
              {L(
                "Photos · up to 3, JPG / PNG / WebP, 1 MB each",
                "사진 · 최대 3장, JPG / PNG / WebP, 각 1MB 이하",
              )}{" "}
              *
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (
                    files.length > 3 ||
                    files.some(
                      (f) =>
                        f.size > 1048576 ||
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          f.type,
                        ),
                    )
                  ) {
                    setMessage(
                      L(
                        "Select up to 3 images, no larger than 1 MB each.",
                        "1MB 이하 이미지 최대 3장을 선택하세요.",
                      ),
                    );
                    e.target.value = "";
                    return;
                  }
                  try {
                    const imgs = await Promise.all(
                      files.map(
                        (f) =>
                          new Promise<string>((resolve, reject) => {
                            const r = new FileReader();
                            r.onload = () => resolve(String(r.result));
                            r.onerror = reject;
                            r.readAsDataURL(f);
                          }),
                      ),
                    );
                    update("images", imgs);
                  } catch {
                    setMessage(
                      L("Unable to read photos.", "사진을 읽지 못했습니다."),
                    );
                  }
                }}
              />
            </label>
            <div className="listing-thumbnails">
              {data.images.map((src, i) => (
                <div key={i}>
                  <img src={src} alt={L("Uploaded photo", "등록 사진")} />
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      update(
                        "images",
                        data.images.filter((_, n) => n !== i),
                      )
                    }
                  >
                    {L("Remove", "삭제")}
                  </button>
                </div>
              ))}
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={data.imageRights}
                onChange={(e) => update("imageRights", e.target.checked)}
              />
              {L(
                "I have permission to publish these photos.",
                "사진의 게시·사용 권리를 보유하고 있습니다.",
              )}{" "}
              *
            </label>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>
              {L("3. Price & visiting information", "3. 가격·방문·이용 정보")}
            </legend>
            <div className="listing-form-grid">
              {(["priceMin", "priceMax", "duration"] as const).map((key) => (
                <label key={key}>
                  {key === "priceMin"
                    ? L("Price from · KRW", "최소 가격 · 원")
                    : key === "priceMax"
                      ? L("Price up to · KRW", "최대 가격 · 원")
                      : L("Duration · min", "이용시간 · 분")}
                  <input
                    type="number"
                    min="0"
                    max={key === "duration" ? 1440 : 10000000}
                    value={data[key]}
                    onChange={(e) => update(key, Number(e.target.value))}
                  />
                </label>
              ))}
              {field(
                "address",
                L("Address / meeting point", "주소·집합 장소"),
                true,
              )}
              {field(
                "contact",
                L("Public inquiry contact", "공개 문의 연락처"),
                true,
              )}
              {field(
                "bookingUrl",
                L(
                  "Official / booking URL · https://",
                  "공식·예약 URL · https://",
                ),
              )}
            </div>
            {field(
              "hours",
              L(
                "Hours / availability / reservation requirements",
                "운영시간·이용 가능 일정·예약 필요 여부",
              ),
              true,
              true,
            )}
            {data.kind === "event" && (
              <div className="listing-form-grid">
                {field("eventStart", L("Event start date", "행사 시작일"), true)}
                {field("eventEnd", L("Event end date", "행사 종료일"), true)}
              </div>
            )}
            {field("inclusions", L("Included", "포함 사항"), false, true)}
            {field("exclusions", L("Not included", "불포함 사항"), false, true)}
            {field(
              "cancellation",
              L("Cancellation / refund policy", "취소·환불 정책"),
              false,
              true,
            )}
            {field(
              "promotion",
              L(
                "Promotion message (no automatic discount)",
                "홍보 문구 (자동 할인 적용 아님)",
              ),
            )}
          </fieldset>
          <div className="listing-actions">
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => save(false)}
            >
              {L("Save draft", "임시저장")}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setPreview(true);
                setTimeout(
                  () =>
                    document
                      .getElementById("listing-preview")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100,
                );
              }}
            >
              {L("Preview detail", "상세 미리보기")}
            </button>
            <button className="primary" disabled={busy} type="submit">
              {busy
                ? L("Saving…", "저장 중…")
                : L("Request publication", "게시 요청")}
            </button>
          </div>
          <p role="status" className="notice">
            {message}
          </p>
        </form>
        <aside className="listing-management">
          <h3>{L("Your registrations", "등록 관리")}</h3>
          {!items.length && (
            <p>{L("No registrations yet.", "아직 등록된 내용이 없습니다.")}</p>
          )}
          {items.map((v) => (
            <div className="listing-management-item" key={v.id}>
              <b>
                {text(v.data, lang, "title") ||
                  L("Untitled draft", "제목 없는 초안")}
              </b>
              <span className="pill">{labels[v.status]}</span>
              {v.reviewNote && <p>{v.reviewNote}</p>}
              <button
                className="secondary"
                onClick={() => {
                  setId(v.id);
                  setData(
                    business
                      ? {
                          ...v.data,
                          businessName: business.businessName,
                          areaId: business.areaId,
                        }
                      : v.data,
                  );
                  setPreview(false);
                  setMessage("");
                }}
              >
                {L("Edit / view", "수정·보기")}
              </button>
              {v.status !== "archived" && (
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("operator/listings/archive", { id: v.id });
                      await load();
                      setMessage(
                        L(
                          "Archived. Edit and resubmit to publish again.",
                          "보관했습니다. 수정·재요청하면 다시 게시할 수 있습니다.",
                        ),
                      );
                    } catch {
                      setMessage(
                        L("Unable to archive.", "보관하지 못했습니다."),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {L("Archive / stop display", "보관·노출 중지")}
                </button>
              )}
              {role === "admin" && v.status === "pending" && (
                <div className="listing-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => review(v, true)}
                  >
                    {L("Approve & publish", "승인·게시")}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => review(v, false)}
                  >
                    {L("Request changes", "수정 요청")}
                  </button>
                </div>
              )}
            </div>
          ))}
          {role === "admin" && (
            <label>
              {L("Review note", "심사 의견")}
              <textarea
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          )}
        </aside>
      </div>
      {preview && (
        <section id="listing-preview" className="listing-preview">
          <h3>{L("Detail page preview", "상세페이지 미리보기")}</h3>
          <ListingDetail data={data} lang={lang} />
        </section>
      )}
    </section>
  );
}
