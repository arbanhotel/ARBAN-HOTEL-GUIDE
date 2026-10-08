import {createRemoteJWKSet,jwtVerify} from 'jose';
import {validatePlaces,resolveImage} from './content.mjs';
const jwks=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function authorize(request,env){
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)||!env.ACCESS_AUD||env.ACCESS_AUD==='REPLACE')throw Error('Not configured');
 const issuer='https://'+env.ACCESS_TEAM_DOMAIN;
 if(!jwks.has(issuer))jwks.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')));
 const {payload}=await jwtVerify(request.headers.get('Cf-Access-Jwt-Assertion')||'',jwks.get(issuer),{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','email']});
 if(!(env.ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).includes(String(payload.email).toLowerCase()))throw Error('Not permitted');
}
async function read(request,env){const obj=await env.CONTENT.get('places.json');if(obj)return {revision:obj.etag,places:(await obj.json()).places};const seed=await env.ASSETS.fetch(new Request(new URL('/seed.json',request.url)));if(!seed.ok)throw Error('Missing seed');return {revision:'',places:await seed.json()};}
async function image(value,env,origin){
 const url=resolveImage(value,env.GUIDE_URL,origin);if(!url.startsWith('data:'))return url;
 const m=url.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('Invalid image');
 const bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));if(bytes.length>2*1024*1024)throw Error('Image too large');
 const signature=m[1]==='png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216: new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';if(!signature)throw Error('Invalid image bytes');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const key='media/'+hash+'.'+m[1];
 await env.CONTENT.put(key,bytes,{httpMetadata:{contentType:'image/'+m[1]}});return origin+'/'+key;
}
async function boundedJSON(req){const reader=req.body?.getReader();if(!reader)throw Error('Missing body');let size=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24*1024*1024){await reader.cancel();throw Error('Too large');}parts.push(value);}const bytes=new Uint8Array(size);let i=0;for(const p of parts){bytes.set(p,i);i+=p.length;}return JSON.parse(new TextDecoder().decode(bytes));}
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 try{
 if(request.method==='GET'&&path==='/api/places'){const data=await read(request,env);const r=json({places:data.places.filter(p=>!p.hidden)});r.headers.set('Access-Control-Allow-Origin',new URL(env.GUIDE_URL).origin);return r;}
 if(request.method==='GET'&&/^\/media\/[a-f0-9]{64}\.(png|jpeg|webp)$/.test(path)){const obj=await env.CONTENT.get(path.slice(1));if(!obj)return new Response('Not found',{status:404});return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata.contentType,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'}});}
 try{await authorize(request,env);}catch{return json({error:'호텔 담당자 로그인이 필요합니다.'},401);}
 if(path==='/api/admin/places'&&request.method==='GET')return json(await read(request,env));
 if(path==='/api/admin/places'&&request.method==='PUT'){
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Arban-Admin')!=='1'||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Invalid request'},403);
  const payload=await boundedJSON(request);validatePlaces(payload.places);if(typeof payload.revision!=='string')return json({error:'Revision required'},400);
  const old=await env.CONTENT.get('places.json');if((old?.etag||'')!==payload.revision)return json({error:'Conflict'},409);
  for(const p of payload.places){for(const k of ['image','listingImage','heroImage','detailImage','characterImage'])if(p[k])p[k]=await image(p[k],env,url.origin);for(const photo of p.extraPhotos||[])photo.src=await image(photo.src,env,url.origin);}
  if(old)await env.CONTENT.put('history/'+old.etag+'.json',await old.text(),{httpMetadata:{contentType:'application/json'}});
  const saved=await env.CONTENT.put('places.json',JSON.stringify({places:payload.places}),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(!saved)return json({error:'Conflict'},409);return json({revision:saved.etag,places:payload.places});
 }
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(path==='/connection-config.js')return new Response('window.ARBAN_CONNECTION='+JSON.stringify({admin:true,guideUrl:env.GUIDE_URL})+';',{headers:{'Content-Type':'text/javascript','Cache-Control':'no-store'}});
 if(!['/','/admin.html','/admin.css','/admin.js','/admin-bootstrap.js','/data.js'].includes(path))return new Response('Not found',{status:404});
 const assetUrl=new URL(request.url);if(path==='/')assetUrl.pathname='/admin.html';const asset=await env.ASSETS.fetch(new Request(assetUrl,request));const response=new Response(asset.body,asset);response.headers.set('Cache-Control','no-store');response.headers.set('X-Frame-Options','DENY');response.headers.set('X-Content-Type-Options','nosniff');return response;
 }catch{return json({error:'입력 내용 또는 서버 설정을 확인해주세요.'},400);}
}};
