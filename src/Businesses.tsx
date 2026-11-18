import { useEffect, useState } from "react";
import { api } from "./api";
import type { Area, Lang } from "../shared/types";
import type { BusinessApplication, BusinessData } from "../shared/business";
async function applicationPhoto(file: File): Promise<string> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw new Error('INVALID_BUSINESS_IMAGE');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;await img.decode();
    const scale=Math.min(1,1600/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL('image/jpeg',.78);if(result.length>900000)throw new Error('INVALID_BUSINESS_IMAGE');return result;
  } finally {URL.revokeObjectURL(url);}
}
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
    INVALID_BUSINESS_IMAGE:['Use a clear JPG, PNG or WebP image under 10 MB. Try a smaller image if needed.','10MB 이하 JPG·PNG·WebP 사진을 선택해주세요. 처리 후에도 크면 더 작은 사진을 사용해주세요.'],
    BUSINESS_IMAGES_REQUIRED:['Add a registration certificate, shop photos and confirm photo rights.','사업자등록증과 상점 사진을 첨부하고 사진 사용 권한에 동의해주세요.'],
    INVALID_BUSINESS_WEBSITE: [
      "Enter a full HTTPS URL, such as https://example.com, or leave this optional field blank.",
      "https://example.com 형식의 전체 주소를 입력하거나 선택사항이므로 비워두세요.",
    ],
    INVALID_BUSINESS_APPLICATION: [
      "Please check the required fields. The service description must be at least 20 characters.",
      "필수 항목을 확인해주세요. 서비스 소개는 20자 이상 입력해야 합니다.",
    ],
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
    schemaVersion:2,category:'food',blog:'',hours:'',menu:'',publicPhone:'',registrationImage:'',shopImages:[],imageRights:false,
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
        setData(previous=>({ ...previous, ...result.application!.data, schemaVersion:2, consent: false }));
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
    <section className="business-application">
      <h3>{L("Partner application", "업체·전문가 등록 신청")}</h3>
      <p className="muted">
        {L(
          "For restaurants, cafés, shops and local experience providers. One business per account.",
          "식당·카페·상점·체험 운영자를 위한 공간입니다. 계정당 업체 1곳을 신청할 수 있습니다.",
        )}
      </p>
      <ol className="partner-steps" aria-label={L('Application steps', '신청 절차')}>
        <li>{L('Sign in', '로그인')}</li><li>{L('Submit details', '업체 정보 작성')}</li><li>{L('Review & approval', '검토 후 승인')}</li>
      </ol>
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
              {L("Open partner dashboard", "파트너 대시보드 열기")}
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
        "Application received. Your shop will be published after administrator approval.",
                        "신청을 접수했습니다. 관리자 승인 후 상점 소개가 공개됩니다.",
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
                  <legend>{L("Business and contact details", "업체 및 담당자 정보")}</legend>
                  <p className="account-help">{L('Fields marked optional may be left blank. Review contacts are not shown publicly.', '선택 표시가 없는 항목은 필수입니다. 심사용 연락처는 공개되지 않습니다.')}</p>
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
                      ['blog', L('Blog / social page (optional)', '블로그·SNS 주소(선택)'), 500],
                      ['publicPhone', L('Public shop phone (optional)', '상점 공개 전화번호(선택)'), 50],
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
                              : key === "website" || key === 'blog'
                                ? "url"
                                : "text"
                        }
                        required={!['website','blog','publicPhone'].includes(key)}
                        maxLength={max}
                        value={data[key] || ''}
                        onChange={(event) =>
                          setData({ ...data, [key]: event.target.value })
                        }
                        onBlur={(event) => {
                          if (['website','blog'].includes(key) && event.target.value && !/^https?:\/\//i.test(event.target.value))
                            setData({ ...data, [key]: `https://${event.target.value}` });
                        }}
                      />
                    </label>
                  ))}
                  <h4>{L('Shop information · public after approval','상점 소개 · 승인 후 공개')}</h4>
                  <label>{L('Business category','업종')}<select value={data.category||'food'} onChange={e=>setData({...data,category:e.target.value})}>{[['food','식당 / Restaurant'],['cafe','카페·베이커리 / Café'],['shopping','상점 / Shop'],['experience','체험 / Experience'],['culture','문화 / Culture'],['wellness','웰니스 / Wellness']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
                  <label>{L('Opening hours, breaks and closed days','영업시간·브레이크타임·휴무일')}<textarea required maxLength={1000} value={data.hours||''} placeholder="월–토 10:00–20:00 / 일요일 휴무" onChange={e=>setData({...data,hours:e.target.value})}/></label>
                  <label>{L('Menu / services and prices','메뉴·서비스 및 가격')}<textarea required maxLength={2000} value={data.menu||''} placeholder="대표 메뉴와 가격 또는 체험 내용을 적어주세요." onChange={e=>setData({...data,menu:e.target.value})}/></label>
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
                  <h4>{L('Attachments','첨부 자료')}</h4>
                  <label>{L('Registration certificate · private review only','사업자등록증 · 심사 전용 비공개')}<small>{L('Hide unrelated personal identifiers. JPG, PNG or WebP; up to 10 MB.','주민등록번호 등 불필요한 개인정보는 가려주세요. JPG·PNG·WebP, 원본 10MB 이하.')}</small><input type="file" accept="image/jpeg,image/png,image/webp" required={!data.registrationImage} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{const image=await applicationPhoto(file);setData(d=>({...d,registrationImage:image}));}catch(error){setMessage(errorText(error,ko));}finally{setBusy(false);}}}/></label>
                  {data.registrationImage&&<img className="business-certificate-preview" src={data.registrationImage} alt={L('Private registration certificate preview','비공개 사업자등록증 미리보기')}/>}
                  <label>{L('Shop photos · 1 to 3 public images','상점 사진 · 공개용 1~3장')}<input type="file" multiple accept="image/jpeg,image/png,image/webp" required={!data.shopImages?.length} onChange={async e=>{const files=Array.from(e.target.files||[]);if(!files.length)return;if(files.length>3){setMessage(L('Choose up to 3 photos.','사진은 최대 3장까지 선택해주세요.'));return;}setBusy(true);try{const images=await Promise.all(files.map(applicationPhoto));setData(d=>({...d,shopImages:images}));}catch(error){setMessage(errorText(error,ko));}finally{setBusy(false);}}}/></label>
                  <div className="business-photo-grid">{data.shopImages?.map((src,i)=><img key={i} src={src} alt={`${L('Shop photo','상점 사진')} ${i+1}`}/>)}</div>
                  <label className="checkbox"><input type="checkbox" required checked={!!data.imageRights} onChange={e=>setData({...data,imageRights:e.target.checked})}/>{L('I may publish these shop photos. Approved shop information will be public.','상점 사진을 게시할 권한이 있으며, 승인된 상점 정보가 공개되는 것에 동의합니다.')}</label>
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
                      : L("Submit shop for review", "상점 정보 제출 · 승인 요청")}
                  </button>
                </fieldset>
              </form>
            )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
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
    [method, setMethod] = useState(application.data.schemaVersion===2?'documents':'business-contact'),
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
        note: action==='approve' && !note.trim() ? '제출 자료와 상점 정보를 검토하여 승인합니다.' : note,
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
      {application.data.schemaVersion===2&&<>
        <dl className="business-review-facts"><dt>업종</dt><dd>{application.data.category}</dd><dt>영업시간·휴무</dt><dd>{application.data.hours}</dd><dt>메뉴·서비스</dt><dd>{application.data.menu}</dd><dt>공개 연락처</dt><dd>{application.data.publicPhone||'미입력'}</dd></dl>
        <div className="business-photo-grid">{application.data.shopImages?.map((src,i)=><img key={i} src={src} alt={`상점 사진 ${i+1}`}/>)}</div>
        {application.data.blog&&<a href={application.data.blog} target="_blank" rel="noopener noreferrer">블로그·SNS ↗</a>}
        <details><summary>사업자등록증 확인 · 비공개 심사 자료</summary><img className="business-certificate-preview" src={application.data.registrationImage} alt="심사용 사업자등록증"/></details>
        <p className="notice">승인하면 제출된 상점 소개·사진·영업시간·메뉴가 공개됩니다. 사업자등록증과 심사용 연락처는 공개하지 않습니다.</p>
      </>}
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
              "Review note (required for rejection or revocation; 10–1000 characters)",
              "심사 메모 · 불승인·권한 회수 시 필수(10~1000자, 신청자에게 표시)",
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
                  disabled={!verified || (!!note.trim() && note.trim().length < 10)}
                  onClick={() => void review("approve")}
                >
                  {L("Approve", application.data.schemaVersion===2?"승인 · 상점 공개":"승인")}
                </button>
                <button
                  className="secondary"
                  disabled={note.trim().length < 10}
                  onClick={() => void review("reject")}
                >
                  {L("Reject · request changes", "불승인 · 수정 요청")}
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
  const [filter,setFilter]=useState('pending');
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
      <div className="quick-categories" role="group" aria-label="신청 상태">{[['pending','심사 대기','Pending'],['approved','승인','Approved'],['rejected','불승인','Rejected'],['all','전체','All']].map(([id,kr,en])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{ko?kr:en} ({items.filter(a=>id==='all'||a.status===id).length})</button>)}</div>
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
      {!!items.length&&!items.some(a=>filter==='all'||a.status===filter)&&<p>{ko?'해당 상태의 신청이 없습니다.':'No applications with this status.'}</p>}
      {items.filter(a=>filter==='all'||a.status===filter).map((application) => (
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
