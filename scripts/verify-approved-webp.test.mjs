import assert from 'node:assert/strict';
import {verifyApprovedBundles} from './verify-approved-webp.mjs';
const rows=verifyApprovedBundles('assets/dragon-mission-approved',{strict:false});
assert.equal(rows.length,40);
assert.ok(rows.some(x=>x.width<1600));
assert.throws(()=>verifyApprovedBundles('assets/dragon-mission-approved',{strict:true}),/non conformes/);
console.log('Audit historique OK; verrou HD strict refuse les images actuelles.');
