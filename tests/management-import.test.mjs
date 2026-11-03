import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRoster,provisionRoster,activationCSV} from '../src/assets/management/import.mjs';
const row={display_name:'TEST PERSON',email:'person@example.test',role:'mentee',field:'Academic & Research'};
test('roster validates unique identities, limits roles, and preserves empty placement',()=>{
 const [r]=validateRoster([row]);assert.equal(r.pathway,'');assert.equal(r.group_id,'');
 assert.equal(validateRoster([row],[{email:row.email}])[0].existing,true);
 for(const patch of [{email:'missing'},{role:'program'},{field:'invented'},{pathway:'Advance'},{group_id:'group'}])assert.throws(()=>validateRoster([{...row,...patch}]));
 assert.throws(()=>validateRoster([row,{...row,email:'PERSON@example.test'}]),/berulang/);
});
test('provisioning uses fresh revisions, skips existing identities and retains successful links after failure',async()=>{
 let revision=0;const calls=[],rows=validateRoster([row,{...row,email:'fails@example.test'},{...row,email:'existing@example.test'}]);
 const store={reload:async()=>{revision++;},read:()=>({revision,profiles:[{email:'existing@example.test'}]}),account:async(data,expected)=>{assert.equal(expected,revision);calls.push(data);if(data.email.startsWith('fails'))throw Error('TEST FAILURE');return{url:'https://example.test/#activate=TEST'};}};
 const results=await provisionRoster(rows,{store,cohort:'TEST COHORT'});
 assert.equal(calls.length,2);assert.equal(calls[0].cohort_id,'TEST COHORT');assert.equal(calls[0].pathway,'');assert.equal(results[0].url,'https://example.test/#activate=TEST');assert.match(results[1].status,/TEST FAILURE/);assert.equal(results[2].status,'Sudah terdaftar');
 const csv=activationCSV([{...row,display_name:'=FORMULA',status:'Menunggu aktivasi',url:results[0].url}]);assert.ok(csv.includes('"\'=FORMULA"'));assert.ok(csv.includes(results[0].url));
});
