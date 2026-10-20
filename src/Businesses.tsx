import { useEffect, useState } from "react";
import { api } from "./api";
import type { Area, Lang } from "../shared/types";
import type { BusinessApplication, BusinessData } from "../shared/business";
const labels = (ko: boolean) =>
  ko
    ? {
        pending: "심사 대기",
        approved: "승인 완료",
        rejected: "수정 후 재신청",
        revoked: "전문가 권한 회수",
      }
    : {
        pending: "Awaiting review",
        approved: "Approved",
        rejected: "Changes requested",
        revoked: "Partner access revoked",
      };
function errorText(error: unknown, ko: boolean) {
  const code = (error as Error).message;
  const messages: Record<string, [string, string]> = {
    BUSINESS_ALREADY_SUBMITTED: [
      "An application is already under review. Reload its status.",
      "이미 심사 중인 신청이 있습니다. 상태를 다시 확인해주세요.",
    ],
    BUSINESS_REVIEW_STALE: [
      "This application changed. Reload before reviewing it.",
      "신청 상태가 변경됐습니다. 새로 확인한 뒤 심사해주세요.",
    ],
    BUSINESS_VERIFICATION_REQUIRED: [
      "Record the ownership check before approval.",
      "소유권 확인 방법과 확인 여부를 기록해주세요.",
    ],
    BUSINESS_REVIEW_REQUIRED: [
      "Add a review note of at least 10 characters.",
      "심사 메모를 10자 이상 입력해주세요.",
    ],
    SIGN_IN_REQUIRED: ["Sign in before applying.", "로그인한 뒤 신청해주세요."],
  };
  return (
    messages[code]?.[ko ? 1 : 0] ||
    (ko
      ? "처리하지 못했습니다. 입력 내용과 연결을 확인한 뒤 다시 시도해주세요."
      : "Unable to complete this request. Check the details and connection, then retry.")
  );
}
export function BusinessApplicationPanel({
  lang,
  status,
  areas,
  onOpenStudio,
}: {
  lang: Lang;
  status: any;
  areas: Area[];
  onOpenStudio: () => Promise<void>;
}) {
  const ko = lang === "ko",
    signedIn = !!status?.session.authenticated;
  const L = (en: string, kr: string) => (ko ? kr : en);
  const [application, setApplication] = useState<BusinessApplication | null>(
    null,
  );
  const [loading, setLoading] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [data, setData] = useState<BusinessData>({
    businessName: "",
    areaId: areas[0].id,
    address: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    description: "",
    consent: false,
  });
  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await api<{ application: BusinessApplication | null }>(
        "business/application",
      );
      setApplication(result.application);
      if (result.application)
        setData({ ...result.application.data, consent: false });
      setLoaded(true);
    } catch (error) {
      setMessage(errorText(error, ko));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, status?.session.email]);
  return (
    <details className="business-application">
      <summary>{L("Register your business", "업체·전문가 등록 신청")}</summary>
      <p className="muted">
        {L(
          "Apply → ownership check → partner approval → product registration → publication review. One business per account for this MVP.",
          "신청 → 소유권 확인 → 전문가 승인 → 상품 등록 → 게시 심사 순서입니다. 초기에는 계정당 업체 1곳을 등록할 수 있습니다.",
        )}
      </p>
      {!signedIn ? (
        <p className="notice">
          {L(
            "Sign in above to apply. Registration does not grant partner access automatically.",
            "위에서 로그인한 뒤 신청할 수 있습니다. 신청만으로 전문가 권한이 생기지는 않습니다.",
          )}
        </p>
      ) : (
        <>
          <button
            className="secondary"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            {loading
              ? L("Loading…", "확인 중…")
              : L("Refresh application status", "신청 상태 새로 확인")}
          </button>
          {application && (
            <div className="notice">
              <strong>{labels(ko)[application.status]}</strong>
              <p>{application.data.businessName}</p>
              {application.reviewNote && <p>{application.reviewNote}</p>}
            </div>
          )}
          {application?.status === "approved" && (
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onOpenStudio();
                } catch (error) {
                  setMessage(errorText(error, ko));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {L("Open partner studio", "전문가 등록 화면 열기")}
            </button>
          )}
          {loaded &&
            status.session.role === "traveler" &&
            (!application ||
              ["rejected", "revoked"].includes(application.status)) && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  setMessage("");
                  try {
                    const result = await api<{
                      application: BusinessApplication;
                    }>("business/application", { data });
                    setApplication(result.application);
                    setData({ ...data, consent: false });
                    setMessage(
                      L(
                        "Application received. Partner access begins after approval.",
                        "신청을 접수했습니다. 관리자 승인 후 전문가 기능을 이용할 수 있습니다.",
                      ),
                    );
                  } catch (error) {
                    setMessage(errorText(error, ko));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <fieldset disabled={busy}>
                  <legend>{L("Business details", "업체 정보")}</legend>
                  {(
                    [
                      ["businessName", L("Business name", "업체명"), 120],
                      ["address", L("Business address", "업체 주소"), 300],
                      ["contactName", L("Contact person", "담당자명"), 80],
                      [
                        "contactEmail",
                        L("Review contact email", "심사용 이메일"),
                        254,
                      ],
                      [
                        "contactPhone",
                        L("Review contact phone", "심사용 연락처"),
                        50,
                      ],
                      [
                        "website",
                        L(
                          "Website (HTTPS, optional)",
                          "업체 홈페이지(HTTPS, 선택)",
                        ),
                        500,
                      ],
                    ] as const
                  ).map(([key, title, max]) => (
                    <label key={key}>
                      {title}
                      <input
                        type={
                          key === "contactEmail"
                            ? "email"
                            : key === "contactPhone"
                              ? "tel"
                              : key === "website"
                                ? "url"
                                : "text"
                        }
                        required={key !== "website"}
                        maxLength={max}
                        value={data[key]}
                        onChange={(event) =>
                          setData({ ...data, [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    {L("Busan district", "부산 구·군")}
                    <select
                      value={data.areaId}
                      onChange={(event) =>
                        setData({ ...data, areaId: event.target.value })
                      }
                    >
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name[lang] || area.name.en}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {L(
                      "Services and ownership verification contact (20–2000 characters)",
                      "서비스 소개와 소유권 확인 연락 방법(20~2000자)",
                    )}
                    <textarea
                      required
                      minLength={20}
                      maxLength={2000}
                      rows={4}
                      value={data.description}
                      onChange={(event) =>
                        setData({ ...data, description: event.target.value })
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      required
                      checked={data.consent}
                      onChange={(event) =>
                        setData({ ...data, consent: event.target.checked })
                      }
                    />
                    {L(
                      "I agree to provide these details for business verification. Contact details are visible to reviewers, not the public catalogue. Retention/deletion procedures must be finalized before launch.",
                      "업체 확인을 위한 정보 제공에 동의합니다. 심사용 연락처는 관리자에게만 제공되며 공개 목록에 표시되지 않습니다. 정식 운영 전 보관·삭제 절차가 확정되어야 합니다.",
                    )}
                  </label>
                  <button className="primary" type="submit">
                    {busy
                      ? L("Submitting…", "신청 중…")
                      : L("Request partner approval", "업체 승인 신청")}
                  </button>
                </fieldset>
              </form>
            )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

function BusinessReviewCard({
  application,
  lang,
  areas,
  onChanged,
}: {
  application: BusinessApplication;
  lang: Lang;
  areas: Area[];
  onChanged: () => Promise<void>;
}) {
  const ko = lang === "ko",
    L = (en: string, kr: string) => (ko ? kr : en);
  const [note, setNote] = useState(""),
    [method, setMethod] = useState("business-contact"),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const review = async (action: "approve" | "reject" | "revoke") => {
    setBusy(true);
    setError("");
    try {
      await api("operator/businesses/review", {
        id: application.id,
        revision: application.revision,
        action,
        note,
        verificationMethod: method,
        ownershipVerified: verified,
      });
      setNote("");
      setVerified(false);
      await onChanged();
    } catch (error) {
      setError(errorText(error, ko));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="business-review-card">
      <h3>
        {application.data.businessName}{" "}
        <span className="pill">{labels(ko)[application.status]}</span>
      </h3>
      <p>
        {areas.find((area) => area.id === application.data.areaId)?.name[lang]}{" "}
        · {application.data.address}
      </p>
      <p>
        {application.data.contactName} · {application.data.contactEmail} ·{" "}
        {application.data.contactPhone}
      </p>
      <p>{application.data.description}</p>
      {application.data.website && (
        <a
          href={application.data.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          {L("Business website", "업체 홈페이지")} ↗
        </a>
      )}
      {application.reviewNote && (
        <p className="notice">{application.reviewNote}</p>
      )}
      {["pending", "approved"].includes(application.status) && (
        <fieldset disabled={busy}>
          <legend>
            {L("Human verification and decision", "운영자 확인 및 심사")}
          </legend>
          {application.status === "pending" && (
            <>
              <label>
                {L("Ownership check method", "소유권 확인 방법")}
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                >
                  <option value="business-contact">
                    {L("Business contact verified", "업체 연락처 확인")}
                  </option>
                  <option value="onsite">
                    {L("On-site verification", "현장 확인")}
                  </option>
                  <option value="documents">
                    {L("Business documents reviewed", "사업 증빙 확인")}
                  </option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(event) => setVerified(event.target.checked)}
                />
                {L(
                  "I have independently confirmed that this applicant can represent this business.",
                  "신청자가 이 업체를 대표할 수 있음을 별도로 확인했습니다.",
                )}
              </label>
            </>
          )}
          <label>
            {L(
              "Review note (10–1000 characters, visible to applicant)",
              "심사 메모(10~1000자, 신청자에게 표시)",
            )}
            <textarea
              minLength={10}
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="inline">
            {application.status === "pending" ? (
              <>
                <button
                  className="primary"
                  disabled={!verified || note.trim().length < 10}
                  onClick={() => void review("approve")}
                >
                  {L("Approve partner access", "전문가 권한 승인")}
                </button>
                <button
                  className="secondary"
                  disabled={note.trim().length < 10}
                  onClick={() => void review("reject")}
                >
                  {L("Request changes", "수정 요청")}
                </button>
              </>
            ) : (
              <button
                className="secondary"
                disabled={note.trim().length < 10}
                onClick={() => void review("revoke")}
              >
                {L(
                  "Revoke access and hide published listings",
                  "권한 회수 및 게시물 비공개",
                )}
              </button>
            )}
          </div>
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function AdminBusinesses({
  lang,
  areas,
}: {
  lang: Lang;
  areas: Area[];
}) {
  const ko = lang === "ko";
  const [items, setItems] = useState<BusinessApplication[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems((await api("operator/businesses")).applications);
    } catch (error) {
      setError(errorText(error, ko));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel business-reviews">
      <h2>{ko ? "업체 신청 심사" : "Business application review"}</h2>
      <p className="muted">
        {ko
          ? "신청 정보만으로 자동 승인하지 않습니다. 실제 소유권을 확인한 뒤 심사해주세요."
          : "Applications are not verified automatically. Check business ownership before approving access."}
      </p>
      <button
        className="secondary"
        disabled={loading}
        onClick={() => void load()}
      >
        {ko ? "목록 새로 확인" : "Refresh applications"}
      </button>
      {loading && <p>{ko ? "불러오는 중…" : "Loading…"}</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !items.length && (
        <p>
          {ko
            ? "접수된 업체 신청이 없습니다."
            : "No business applications yet."}
        </p>
      )}
      {items.map((application) => (
        <BusinessReviewCard
          key={`${application.id}:${application.revision}`}
          application={application}
          lang={lang}
          areas={areas}
          onChanged={load}
        />
      ))}
    </section>
  );
}
