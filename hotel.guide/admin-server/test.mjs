import test from 'node:test';import assert from 'node:assert/strict';import {validatePlaces,resolveImage} from './content.mjs';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const c={window:{}};vm.createContext(c);vm.runInContext(readFileSync(new URL('../data.js',import.meta.url),'utf8'),c);const data=JSON.parse(JSON.stringify(c.window.GUIDE_DATA.places));
test('existing 46 places pass schema',()=>assert.equal(validatePlaces(data).length,46));
test('duplicate ID rejected',()=>assert.throws(()=>validatePlaces([data[0],data[0]])));
test('script map link rejected',()=>assert.throws(()=>validatePlaces([{...data[0],naverUrl:'javascript:alert(1)'}])));
test('invalid category rejected',()=>assert.throws(()=>validatePlaces([{...data[0],category:'unknown'}])));
test('original image becomes absolute',()=>assert.equal(resolveImage('../places/a.webp','https://site.test/hotel.guide/','https://admin.test'),'https://site.test/places/a.webp'));
test('foreign image origin rejected',()=>assert.throws(()=>resolveImage('https://evil.test/a.png','https://site.test/hotel.guide/','https://admin.test')));
test('empty list allows deleting last place',()=>assert.deepEqual(validatePlaces([]),[]));
