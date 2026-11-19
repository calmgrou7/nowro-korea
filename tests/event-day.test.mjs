import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDayGroup,eventStartDate} from '../shared/event-day.ts';
test('home partitions today, upcoming and undated events using Korea date',()=>{
 const now=new Date('2026-11-18T15:01:00Z');
 assert.equal(eventDayGroup({eventStart:'2026-11-19',eventEnd:'2026-11-19'},now),'today');
 assert.equal(eventDayGroup({eventStart:'2026-11-10',eventEnd:'2026-11-19'},now),'today');
 assert.equal(eventDayGroup({eventStart:'2026-11-26',eventEnd:'2026-12-25'},now),'upcoming');
 assert.equal(eventDayGroup({eventStart:'2026-11-10',eventEnd:'2026-11-18'},now),'other');
 assert.equal(eventDayGroup({MAIN_TITLE:'상시 체험'},now),'other');
 assert.equal(eventDayGroup({op_st_dt:'2026-11-19',op_ed_dt:'2026-11-30'},now),'today');
 assert.equal(eventStartDate({eventstartdate:'20261126'}),'2026-11-26');
 assert.equal(eventStartDate({USAGE_DAY_WEEK_AND_TIME:'2026년 11월 26일 ~ 12월 25일'}),'2026-11-26');
 assert.equal(eventStartDate({eventStart:'2026-02-30'}),null);
});
