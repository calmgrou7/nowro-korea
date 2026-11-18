import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
test('bookmarks deduplicate across views, toggle off, preserve unrelated places and notify',()=>{
 const data=new Map();let events=0;
 const context={exports:{},require:name=>name==='./analytics'?{track:()=>{}}:{},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},window:{dispatchEvent:()=>events++},Event:class{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/SavedPlaces.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 const {savePlace,readSavedPlaces}=context.exports;
 savePlace({contentid:'10',UC_SEQ:'places-10',routePlaceId:'kto-10'});savePlace({UC_SEQ:'other'});
 savePlace({contentid:'10',UC_SEQ:'nearby-10',routePlaceId:'kto-10'});
 assert.equal(readSavedPlaces().length,1);assert.equal(readSavedPlaces()[0].UC_SEQ,'other');
 savePlace({contentid:'10',UC_SEQ:'nearby-10'});assert.equal(readSavedPlaces().length,2);assert.equal(events,4);
 data.set('nowro-saved-places-v1',JSON.stringify([null,{}, {contentid:'10',UC_SEQ:'places-10'},{contentid:'10',UC_SEQ:'nearby-10'}]));
 assert.equal(readSavedPlaces().length,1);
 savePlace({UC_SEQ:'festivals-71'});savePlace({UC_SEQ:'festivals-71',routePlaceId:'busan-festivals-71'});assert.equal(readSavedPlaces().length,1);
});

test('corrupt bookmarks and full storage never overwrite the original or announce success',()=>{
 const key='nowro-saved-places-v1';const data=new Map([[key,'{broken']]);let failures=0,success=0;
 let full=false;
 const context={exports:{},require:name=>name==='./analytics'?{track:()=>{}}:{},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(full)throw new Error('QuotaExceededError');data.set(k,v);}},window:{dispatchEvent:e=>{if(e.type==='nowro-storage-error')failures++;else success++;}},Event:class{constructor(type){this.type=type;}}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/SavedPlaces.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 assert.equal(context.exports.savePlace({contentid:'1'}),false);assert.equal(data.get(key),'{broken');
 const valid=JSON.stringify([{contentid:'2'}]);data.set(key,valid);full=true;
 assert.equal(context.exports.savePlace({contentid:'1'}),false);assert.equal(data.get(key),valid);
 assert.equal(failures,2);assert.equal(success,0);
 full=false;context.exports.savePlace({contentid:'1'});assert.equal(data.get(key+'-backup'),valid);assert.equal(success,1);
});
