import test from 'node:test';
import assert from 'node:assert/strict';
import {eventEndDate,eventExpired} from '../shared/event-dates.ts';
test('event end dates handle provider formats and shortened ranges without treating hours as dates',()=>{
 assert.equal(eventEndDate({eventenddate:'20261107'}),'2026-11-07');
 assert.equal(eventEndDate({op_ed_dt:'2026.11.08'}),'2026-11-08');
 assert.equal(eventEndDate({USAGE_DAY_WEEK_AND_TIME:'2026. 11. 8.(일) ~ 11. 10.(화)'}),'2026-11-10');
 assert.equal(eventEndDate({USAGE_DAY_WEEK_AND_TIME:'2026.12.30 ~ 1.2'}),'2027-01-02');
 assert.equal(eventEndDate({USAGE_DAY_WEEK_AND_TIME:'10:00 ~ 18:00, 매년 7월'}),null);
 assert.equal(eventEndDate({eventenddate:'20260230'}),null);
 assert.equal(eventEndDate({op_at:'Y',op_ed_dt:'2020-01-01'}),null);
 assert.equal(eventEndDate({ITEMCNTNTS:'행사 일시: 2026. 6. 19.(금) ~ 6. 20.(토) 장소: 부산항'}),'2026-06-20');
 assert.equal(eventEndDate({ITEMCNTNTS:'2000. 1. 1. 설립된 상설 체험입니다.'}),null);
});
test('events remain active through the end date in Korea and undated listings are retained',()=>{
 const item={eventenddate:'20261108'};
 assert.equal(eventExpired(item,new Date('2026-11-08T14:59:59Z')),false);
 assert.equal(eventExpired(item,new Date('2026-11-08T15:00:00Z')),true);
 assert.equal(eventExpired({USAGE_DAY_WEEK_AND_TIME:'상시 운영'}),false);
});
