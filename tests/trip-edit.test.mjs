import test from 'node:test';
import assert from 'node:assert/strict';
import {shortenTrip} from '../shared/trip-edit.ts';
test('shortening a future itinerary preserves date, origin, deadline and selected stops',()=>{
 const original={startAt:'2030-01-15T02:00:00Z',origin:{lat:35.15,lng:129.1},minutes:120,deadline:'2030-01-15T05:00:00Z',requiredPlaceIds:['festival','cafe']};
 const next=shortenTrip(original);
 assert.deepEqual(next,{...original,minutes:90});
 assert.equal(original.minutes,120);
 assert.equal(shortenTrip({...original,minutes:40}).minutes,30);
});
