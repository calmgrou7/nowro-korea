import test from 'node:test';
import assert from 'node:assert/strict';
import {pageMetadata,renderPageMetadata} from '../shared/page-metadata.ts';
import fs from 'node:fs';
test('public pages have canonical metadata while account and auth URLs are not indexed',()=>{
 const meta=pageMetadata(new URL('https://nowrokorea.com/?tab=ABOUT&board=guide&token=secret'));
 assert.match(meta.title,/이용가이드/);assert.equal(meta.noindex,true);assert.ok(!meta.canonical.includes('secret'));
 assert.equal(pageMetadata(new URL('https://nowrokorea.com/?tab=TRIP')).noindex,true);
 const html=renderPageMetadata(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),new URL('https://nowrokorea.com/?tab=MAP'));
 assert.match(html,/<title>Busan attractions/);assert.match(html,/canonical" href="https:\/\/nowrokorea.com\/en\/\?tab=MAP/);assert.match(html,/name="robots" content="index,follow"/);
});
