import{test}from'node:test';import assert from'node:assert/strict';import{sourceSnapshot}from'../src/assets/assessment/sources.mjs';
test('source envelope detects process/check/version/cancellation changes but not own review saves',()=>{
 const w={records:[{id:'a',kind:'checkin',month_no:2,latest_version:1,versions:[{id:'v1',number:1}],checks:[{id:'c1'}]}],sessions:[{id:'s1',month_no:2,cancelled:false,participant_ids:['mentee'],starts_at:'2026-02-01T00:00:00Z'}]};
 const snapshot=sourceSnapshot(w,6),newReview={id:'r1',kind:'review',month_no:6,versions:[{id:'rv',number:1}],checks:[]};w.records.push(newReview);assert.equal(sourceSnapshot(w,6),snapshot);
 w.records[0].checks.push({id:'c2'});assert.notEqual(sourceSnapshot(w,6),snapshot);w.records[0].checks.pop();
 w.records[0].latest_version=2;assert.notEqual(sourceSnapshot(w,6),snapshot);w.records[0].latest_version=1;
 w.sessions[0].cancelled=true;assert.notEqual(sourceSnapshot(w,6),snapshot);
});
