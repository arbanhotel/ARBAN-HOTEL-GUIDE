export function validatePlaces(places){
 if(!Array.isArray(places)||places.length>300)throw Error('Invalid places');
 const seen=new Set();
 for(const p of places){
  if(!p||typeof p.id!=='string'||!/^[a-z0-9-]{1,100}$/.test(p.id)||seen.has(p.id)||!['food','cafe','sights','shopping'].includes(p.category)||typeof p.name!=='string'||!p.name.trim())throw Error('Invalid place');
  seen.add(p.id);
  if(p.hidden!==undefined&&typeof p.hidden!=='boolean')throw Error('Invalid visibility');
  for(const [k,v] of Object.entries(p)){if(k==='extraPhotos')continue;if(k==='tags'){if(!Array.isArray(v)||!v.every(t=>typeof t==='string'))throw Error('Invalid tags');continue;}if(typeof v!=='string'&&typeof v!=='boolean'&&v!==null)throw Error('Invalid field');if(typeof v==='string'&&v.length>3_000_000)throw Error('Field too long');}
  for(const k of ['naverUrl','googleUrl'])if(p[k]&&!/^https?:\/\//.test(p[k]))throw Error('Invalid map');
  if(p.extraPhotos!==undefined&&(!Array.isArray(p.extraPhotos)||p.extraPhotos.length>20||!p.extraPhotos.every(x=>x&&typeof x.src==='string'&&(x.label===undefined||typeof x.label==='string'))))throw Error('Invalid photos');
 }
 return places;
}
export function resolveImage(value,guideUrl,serverOrigin){
 if(!value)return '';
 if(value.startsWith('data:image/'))return value;
 const u=new URL(value,guideUrl),guide=new URL(guideUrl);
 if(u.protocol!=='https:'||![guide.origin,serverOrigin].includes(u.origin))throw Error('Invalid image origin');
 return u.href;
}
