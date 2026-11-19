import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/SavedPlaces.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function visit(data=new Map()){
 const context={exports:{},require:name=>name==='./analytics'?{track:()=>{}}:{},localStorage:{removeItem:k=>data.delete(k)},window:{dispatchEvent:()=>{}},Event:class{}};
 vm.runInNewContext(source,context);return context.exports;
}
test('only this visit selections are shown; old persistent bookmarks and backups are removed',()=>{
 const data=new Map([['nowro-saved-places-v1',JSON.stringify([{contentid:'old'}])],['nowro-saved-places-v1-backup','old']]);
 const a=visit(data);assert.equal(a.readSavedPlaces().length,0);assert.equal(data.size,0);
 a.savePlace({contentid:'10'});a.savePlace({UC_SEQ:'other'});a.savePlace({contentid:'10',UC_SEQ:'nearby-10'});
 assert.equal(a.readSavedPlaces().length,1);assert.equal(a.readSavedPlaces()[0].UC_SEQ,'other');
 assert.equal(visit(data).readSavedPlaces().length,0);
});
test('sign-in, account switches and sign-out clear this visit; same account refresh does not',()=>{
 const a=visit();a.savePlace({contentid:'1'});a.resetSavedPlaceSession('guest');assert.equal(a.readSavedPlaces().length,1);
 a.resetSavedPlaceSession('owner@example.com');assert.equal(a.readSavedPlaces().length,0);
 a.savePlace({contentid:'2'});a.resetSavedPlaceSession('owner@example.com');assert.equal(a.readSavedPlaces().length,1);
 a.resetSavedPlaceSession('other@example.com');assert.equal(a.readSavedPlaces().length,0);
 a.savePlace({contentid:'3'});a.resetSavedPlaceSession('guest');assert.equal(a.readSavedPlaces().length,0);
});
