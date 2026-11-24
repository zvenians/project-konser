import test from "node:test";
import assert from "node:assert/strict";
import { countdown, livestreamPackages, venueClasses } from "../lib/event.ts";

test("official venue categories, capacity, and prices",()=>{
  assert.equal(venueClasses.reduce((sum,item)=>sum+item.capacity,0),1685);
  assert.deepEqual(venueClasses.map(item=>item.name),["VVIP","VIP","GOLD","SILVER","REGULER"]);
  assert.deepEqual(venueClasses.map(item=>item.price),[2000000,1000000,500000,250000,100000]);
});
test("livestream packages remain distinct from venue categories",()=>{
  assert.deepEqual(livestreamPackages.map(item=>item.name),["Simfoni Iman","Simfoni Agung","Simfoni Harapan","Simfoni Pujian","Simfoni Syukur","Simfoni Kasih","Simfoni Setia"]);
  assert.deepEqual(livestreamPackages.map(item=>item.price),[2000000,1000000,750000,500000,250000,100000,50000]);
});
test("WIB start, live and ended phases",()=>{
  const start=Date.parse("2027-02-07T12:00:00Z");
  assert.deepEqual(countdown(start-86401000).values,[1,0,0,1]);
  assert.equal(countdown(start).phase,"live");
  assert.equal(countdown(start+3*3600000).phase,"ended");
  assert.deepEqual(countdown(start+3*3600000).values,[0,0,0,0]);
});
