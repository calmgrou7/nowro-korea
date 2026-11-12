import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesDistrict} from '../shared/location-quality.ts';
import {distinctEvents} from '../shared/event-identity.ts';
test('Seo-gu excludes Gangseo-gu, including misleading metadata',()=>{
 const seo=['서구','Seo-gu'];
 for(const addr1 of ['부산광역시 강서구 명지동','Myeongji-dong, Gangseo-gu, Busan']) assert.equal(matchesDistrict({addr1,GUGUN_NM:'서구'},seo),false);
 for(const addr1 of ['부산광역시 서구 암남동','Amnam-dong, Seo-gu, Busan']) assert.equal(matchesDistrict({addr1},seo),true);
});
test('event duplicates match bilingual aliases but keep separate venues and dates',()=>{
 const event={MAIN_TITLE:'부산 축제',ADDR1:'서구 송도',eventStart:'2026-11-10',eventEnd:'2026-11-14'};
 assert.equal(distinctEvents([event,{...event,MAIN_TITLE:'Busan Festival (부산축제)'},{...event,ADDR1:'강서구 명지'},{...event,eventStart:'2026-11-12'}]).length,3);
});
