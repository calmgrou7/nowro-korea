import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExhibitionLocation,exhibitionLocation} from '../server/exhibition-location.mjs';
const row=(name,address)=>`<tr><td><a href="/placeinfo/view.nm?skey=197">${name}</a><br>개관연도 1996</td><td>시설</td><td>051-000-0000</td><td>홈페이지</td><td>${address}</td></tr>`;
const html=rows=>`<table><thead><tr><th>시설명</th><th>주소</th></tr></thead><tbody>${rows}</tbody></table><script>var cltrLatLng = new kakao.maps.LatLng("35.179805", "129.074985"); var place_nm="부산시청 전시실";</script>`;
test('official exhibition venue address determines district and matching map coordinates',()=>{
 const value=parseExhibitionLocation(html(row('부산시청 전시실','부산광역시 연제구 중앙대로 1001')));assert.equal(value.GUGUN_NM,'연제구');assert.equal(value.LAT,35.179805);assert.equal(value.venueName,'부산시청 전시실');assert.ok(!value.ADDR1.includes('개관연도'));
 const two=html(row('다른 곳','부산광역시 수영구 광안로 1')+row('부산시청 전시실','부산광역시 연제구 중앙대로 1001'));
 assert.equal(parseExhibitionLocation(two).GUGUN_NM,'연제구');assert.equal(parseExhibitionLocation(two.replace('var place_nm="부산시청 전시실";','')),null);
 assert.equal(parseExhibitionLocation(html(row('다른 도시','서울특별시 중구 1'))),null);
 assert.equal(parseExhibitionLocation(html(row('부산시청 전시실','부산광역시 연제구 중앙대로 1001')).replace('cltrLatLng','genericCenter')),null);
});
test('exhibition venue resolver rejects malformed identifiers',async()=>{assert.equal((await exhibitionLocation('../private')).status,'invalid_id');});
