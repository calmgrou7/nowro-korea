import test from 'node:test';
import assert from 'node:assert/strict';
import {apiTranslation,cleanApiText} from '../shared/api-translations.ts';
test('current festival titles and addresses have all four preview translations',()=>{
 const values=['광안리 M(Marvelous) 드론 × 레이저쇼','부산국제매직페스티벌','게임문화축제','부산광역시 수영구 광안해변로 219 (광안동)','부산광역시 해운대구 수영강변대로 120 (우동)','부산광역시 해운대구 APEC로 30 (우동)'];
 for(const text of values)for(const lang of ['en','ja','zh-CN','zh-TW']){
  assert.notEqual(apiTranslation(text,lang),text);
  assert.equal(apiTranslation(text,lang,false),text);
 }
});
test('translation preview preserves unknown originals and can be turned off',()=>{
 const title='초록마술사의 과학마술쇼 [부산]';
 for(const lang of ['en','ja','zh-CN','zh-TW']){assert.notEqual(apiTranslation(title,lang),title);assert.equal(apiTranslation(title,lang,false),title);}
 assert.equal(apiTranslation(title,'ko'),title);
 assert.equal(apiTranslation('새롭게 등록된 공연','ja'),'새롭게 등록된 공연');
 assert.equal(apiTranslation('ONE HOUR [부산] (11월)','en'),'ONE HOUR · Busan · November');
 assert.equal(cleanApiText('&lt함께 달린 시간&gt'),'<함께 달린 시간>');
 assert.equal(apiTranslation('연제구','ja'),'蓮堤区');
});
