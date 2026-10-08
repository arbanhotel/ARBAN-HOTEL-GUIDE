import {mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('./public/',import.meta.url),{recursive:true});
for(const name of ['admin.html','admin.css','admin.js','admin-bootstrap.js','data.js'])await copyFile(new URL('../'+name,import.meta.url),new URL('./public/'+name,import.meta.url));
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const c={window:{}};vm.createContext(c);vm.runInContext(await readFile(new URL('../data.js',import.meta.url),'utf8'),c);
const guide='https://songjieun2006-collab.github.io/ARBAN-HOTEL/hotel.guide/';
for(const p of c.window.GUIDE_DATA.places){for(const k of ['image','listingImage','heroImage','detailImage','characterImage'])if(p[k])p[k]=new URL(p[k],guide).href;for(const photo of p.extraPhotos||[])photo.src=new URL(photo.src,guide).href;}
await writeFile(new URL('./public/seed.json',import.meta.url),JSON.stringify(c.window.GUIDE_DATA.places));
