import type { Place } from "./types.ts";
export type PlaceMedia = {
  src: string;
  alt: string;
  generated: boolean;
  credit: string;
  source?: string;
  license?: string;
  licenseUrl?: string;
};
export const scenery: Record<string, PlaceMedia> = {
  gwangalli: {
    src: "/images/gwangalli.webp",
    alt: "Gwangalli Beach and Gwangan Bridge, Busan",
    generated: false,
    credit: "Masterhatch",
    source:
      "https://commons.wikimedia.org/wiki/File:Gwangalli_Beach_and_Gwangan_Bridge_Busan.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  haeundae: {
    src: "/images/haeundae.webp",
    alt: "Haeundae Beach, Busan",
    generated: false,
    credit: "Jon Åslund",
    source:
      "https://commons.wikimedia.org/wiki/File:Haeundae_beach_in_Busan.jpg",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  yeongdo: {
    src: "/images/yeongdo.webp",
    alt: "Huinnyeoul Culture Village, Yeongdo, Busan",
    generated: false,
    credit: "Choi2451",
    source:
      "https://commons.wikimedia.org/wiki/File:Huinnyeoul_culture_village,_Busan_on_October_25th,_2019.jpg",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
};
const representative: Record<string, PlaceMedia> = {
  cafe: {
    src: "/images/cafe.webp",
    alt: "AI representative image of a seaside café with coffee",
    generated: true,
    credit: "NOWRO · OpenAI imagegen",
  },
  food: {
    src: "/images/food.webp",
    alt: "AI representative image of Busan-style pork soup and side dishes",
    generated: true,
    credit: "NOWRO · OpenAI imagegen",
  },
  experience: {
    src: "/images/experience.webp",
    alt: "AI representative image of a ceramics workshop",
    generated: true,
    credit: "NOWRO · OpenAI imagegen",
  },
  culture: {
    src: "/images/culture.webp",
    alt: "AI representative image of a neighborhood design shop and gallery",
    generated: true,
    credit: "NOWRO · OpenAI imagegen",
  },
};
// Image evidence is separate from business verification and persisted fixture data.
export function placeMedia(place: Place): PlaceMedia {
  if (
    place.category === "sea" ||
    place.category === "wellness" ||
    place.id === "y-culture"
  )
    return scenery[place.areaId] ?? scenery.gwangalli!;
  return representative[place.category] ?? representative.culture!;
}
