import type { Area, Lang } from "../shared/types";
export function DistrictDirectory({
  areas,
  lang,
  onSelect,
  selected,
}: {
  areas: Area[];
  lang: Lang;
  onSelect: (id: string) => void;
  selected?: string;
}) {
  const ko = lang === "ko";
  return (
    <details className="district-directory">
      <summary>
        {ko ? "부산 16개 구·군 둘러보기" : "Explore all 16 Busan districts"}
        <span>{ko ? "구·군별 탐색" : "Browse by district"}</span>
      </summary>
      <p className="muted">
        {ko
          ? "구·군을 선택해 장소와 상점 콘텐츠를 찾아보세요. 동네 이름으로도 검색할 수 있습니다."
          : "Choose a district to explore places and local providers. You can also search by neighborhood name."}
      </p>
      <div className="district-grid">
        {areas.map((a) => (
          <button
            className={selected === a.id ? "selected" : ""}
            key={a.id}
            aria-pressed={selected === a.id}
            onClick={() => onSelect(a.id)}
          >
            <strong>{a.name[lang] || a.name.en}</strong>
            <small>{a.aliases[lang] || a.aliases.en}</small>
          </button>
        ))}
      </div>
    </details>
  );
}
