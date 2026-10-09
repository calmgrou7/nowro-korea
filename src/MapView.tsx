import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Place, Point, Lang } from "../shared/types.ts";
import { t } from "./i18n";
export default function MapView({
  origin,
  places,
  lang,
  onSelect,
  originLabel,
}: {
  origin: Point;
  places: Place[];
  lang: Lang;
  onSelect: (p: Place) => void;
  originLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    callback = useRef(onSelect);
  callback.current = onSelect;
  const [failed, setFailed] = useState(false);
  const key = places.map((p) => p.id).join("|");
  useEffect(() => {
    if (!ref.current) return;
    setFailed(false);
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView(
      [origin.lat, origin.lng],
      15,
    );
    const tiles = L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL ||
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map);
    tiles.on("tileerror", () => setFailed(true));
    L.circleMarker([origin.lat, origin.lng], {
      radius: 9,
      color: "#fff",
      weight: 3,
      fillColor: "#147D92",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(originLabel || t("where", lang));
    for (const p of places) {
      const marker = L.circleMarker([p.point.lat, p.point.lng], {
        radius: 11,
        color: "#20282B",
        weight: 2,
        fillColor: p.couponId ? "#BEF264" : "#fff",
        fillOpacity: 1,
      }).addTo(map);
      const label = document.createElement("span");
      label.textContent =
        (p.name[lang] || p.name.en) + (p.couponId ? " · NOWRO Pass" : "");
      marker.bindTooltip(label);
      marker.on("click", () => callback.current(p));
    }
    if (places.length)
      map.fitBounds(
        L.latLngBounds([
          [origin.lat, origin.lng],
          ...places.map((p) => [p.point.lat, p.point.lng] as [number, number]),
        ]).pad(0.25),
        { maxZoom: 16 },
      );
    return () => {
      map.remove();
    };
  }, [origin.lat, origin.lng, key, lang, originLabel]);
  return (
    <>
      <div
        className="live-map"
        ref={ref}
        role="region"
        aria-label={t("mapView", lang)}
      />
      <p className="map-legend">
        <span>● {originLabel || t("where", lang)}</span>
        <span>○ {t("stops", lang)}</span>
        <span>◉ NOWRO Pass</span>
      </p>
      {failed && (
        <p className="notice">
          {t("error", lang)} · {t("list", lang)}
        </p>
      )}
    </>
  );
}
