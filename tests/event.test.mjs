import test from "node:test";
import assert from "node:assert/strict";
import { countdown, officialClasses } from "../lib/event.ts";

test("official venue capacity and ticket prices",()=>{
  assert.equal(officialClasses.reduce((sum,item)=>sum+item.capacity,0),1850);
  assert.deepEqual(officialClasses.map(item=>item.venuePrice),[2000000,1000000,500000,250000,100000]);
  assert.deepEqual(officialClasses.map(item=>item.streamPrice),[1000000,500000,250000,100000,50000]);
});
test("WIB start, live and ended phases",()=>{
  const start=Date.parse("2027-02-07T12:00:00Z");
  assert.deepEqual(countdown(start-86401000).values,[1,0,0,1]);
  assert.equal(countdown(start).phase,"live");
  assert.equal(countdown(start+3*3600000).phase,"ended");
  assert.deepEqual(countdown(start+3*3600000).values,[0,0,0,0]);
});
