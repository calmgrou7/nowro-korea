# NOWRO 이미지 자산

2026-10-05: 기존 부산 일러스트를 실제 부산 촬영 사진 및 사진형 AI 대표 이미지로 교체. `public/images`에 WebP로 저장하여 제공한다.

## 실제 촬영 사진

|파일|촬영 장소 / 작가|출처|라이선스|
|---|---|---|---|
|gwangalli.webp|광안리 해변·광안대교 / Masterhatch|[원본](https://commons.wikimedia.org/wiki/File:Gwangalli_Beach_and_Gwangan_Bridge_Busan.jpg)|[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)|
|haeundae.webp|해운대 해변 / Jon Åslund|[원본](https://commons.wikimedia.org/wiki/File:Haeundae_beach_in_Busan.jpg)|[CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)|
|yeongdo.webp|영도 흰여울문화마을 / Choi2451|[원본](https://commons.wikimedia.org/wiki/File:Huinnyeoul_culture_village,_Busan_on_October_25th,_2019.jpg)|[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)|

변경: 최대 가로 1600px 축소, WebP 변환, UI에서 object-fit:cover 크롭. 광안리 WebP에는 원본과 같은 CC BY-SA 4.0 적용. 앱 전체 라이선스는 변경하지 않는다. 메인·장소 상세에 작가·출처·라이선스·변경 사항을 표시. 메인 위치 표시는 실제 사진 촬영 장소인 광안리로 고정.

## AI 대표 이미지

제작 모드: built-in OpenAI imagegen. 신규 생성, 참조 이미지 없음. 특정 실존 업체의 실제 촬영 사진이나 영업 검증 자료가 아니다. 카드에 AI 표시, 상세에 업체 실사진이 아님을 5개 언어로 안내한다. `shared/media.ts`에서 업무 데이터와 분리 관리한다.

|파일|용도|
|---|---|
|cafe.webp|카페: 바다 전망과 커피|
|food.webp|식당·먹거리: 부산식 돼지국밥|
|experience.webp|체험: 도자기 공방|
|culture.webp|문화·쇼핑: 소규모 갤러리·디자인숍|

생성 원본 보존, 웹용 파일만 가로 1200px WebP 변환. 카테고리 대표 이미지이므로 여러 샘플 장소에 같은 이미지가 사용될 수 있다. 업체 실사진과 권리 확인 후 장소별 교체 가능.

## 생성 프롬프트

### cafe

Create a photorealistic editorial travel photograph for a Busan travel app: a welcoming independent seaside cafe, iced americano and ceramic latte cup on a wooden table beside a large window, subtle blue ocean beyond the window, natural daylight, believable lived-in interior and realistic materials. Landscape composition with the drinks near the center safe for mobile card cropping. No logos, readable lettering, watermark, or identifiable named business. This is an illustrative representative photo, not a photograph of a specific establishment.

### food

Create a photorealistic editorial food photograph for a Busan travel app: a small welcoming Korean local restaurant table with steaming Busan-style dwaeji gukbap pork soup, a separate bowl of white rice, kimchi and modest banchan dishes. Authentic everyday meal presentation, natural window light, realistic food texture, three-quarter dining-table viewpoint, landscape composition centered for mobile cards. No readable text, logos, watermark, or named restaurant. Representative imagery, not an actual identified business.

### experience

Create a photorealistic editorial photograph of a small local ceramics workshop suitable for a Busan travel app. Close view of adult hands shaping a clay bowl on a pottery wheel, shelves of handmade bowls softly visible, warm natural daylight, believable wet clay textures, relaxed creative atmosphere. Landscape composition, central subject safe for mobile card crops. No faces, readable text, logos, watermark, or named business. Representative imagery, not an actual identified venue.

### culture

Create a photorealistic editorial photograph for a Busan neighborhood discovery app: a small contemporary neighborhood design shop and gallery, ceramic objects, art prints with abstract shapes, a few books and wooden display shelves, airy white walls, afternoon natural light, authentic modest scale. Landscape composition safe for mobile card crops. No readable lettering, logos, watermark, named venue, or people. Representative imagery, not an actual identified establishment.

