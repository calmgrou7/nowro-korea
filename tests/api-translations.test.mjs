import test from 'node:test';
import assert from 'node:assert/strict';
import {apiTranslation,cleanApiText} from '../shared/api-translations.ts';
test('translation preview preserves unknown originals and can be turned off',()=>{
 const title='초록마술사의 과학마술쇼 [부산]';
 for(const lang of ['en','ja','zh-CN','zh-TW']){assert.notEqual(apiTranslation(title,lang),title);assert.equal(apiTranslation(title,lang,false),title);}
 assert.equal(apiTranslation(title,'ko'),title);
 assert.equal(apiTranslation('새롭게 등록된 공연','ja'),'새롭게 등록된 공연');
 assert.equal(apiTranslation('ONE HOUR [부산] (11월)','en'),'ONE HOUR · Busan · November');
 assert.equal(cleanApiText('&lt함께 달린 시간&gt'),'<함께 달린 시간>');
 assert.equal(apiTranslation('연제구','ja'),'蓮堤区');
});
