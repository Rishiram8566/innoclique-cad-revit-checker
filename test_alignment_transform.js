'use strict';
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const marker = 'function applySimilarity(revitMask,W,H,A0,B0,deg,s,tx,ty){';
const start = html.indexOf(marker);
if (start < 0) throw new Error('applySimilarity not found in shipped HTML');
let depth = 0, end = -1, inString = null, escaped = false, lineComment = false, blockComment = false;
for (let i = start; i < html.length; i++) {
  const c = html[i], n = html[i + 1];
  if (lineComment) { if (c === '\n') lineComment = false; continue; }
  if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i++; } continue; }
  if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === inString) inString = null; continue; }
  if (c === '/' && n === '/') { lineComment = true; i++; continue; }
  if (c === '/' && n === '*') { blockComment = true; i++; continue; }
  if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
  if (c === '{') depth++;
  if (c === '}' && --depth === 0) { end = i + 1; break; }
}
if (end < 0) throw new Error('Could not isolate applySimilarity');
const applySimilarity = new Function(html.slice(start, end) + '; return applySimilarity;')();
function mask(W,H,points) { const m = new Uint8Array(W*H); for (const [x,y] of points) m[y*W+x] = 1; return m; }
function points(m,W) { const p=[]; for(let i=0;i<m.length;i++) if(m[i]) p.push([i%W,Math.floor(i/W)]); return p; }
function centroid(m,W) { const p=points(m,W); const s=p.reduce((a,q)=>[a[0]+q[0],a[1]+q[1]],[0,0]); return [s[0]/p.length,s[1]/p.length,p.length]; }
function near(a,b,t=0.8){ return Math.abs(a[0]-b[0])<=t && Math.abs(a[1]-b[1])<=t; }
const W=100,H=100,srcPts=[];
for(let x=20;x<=80;x++) srcPts.push([x,30]);
for(let y=20;y<=70;y++) srcPts.push([50,y]);
const src=mask(W,H,srcPts), center={cx:50,cy:45};
// Identity must preserve every source pixel exactly.
const identity=applySimilarity(src,W,H,center,center,0,1,0,0);
if(identity.reduce((a,v)=>a+v,0)!==src.reduce((a,v)=>a+v,0)) throw new Error('identity changed pixel count');
for(const p of points(src,W)) if(!identity[p[1]*W+p[0]]) throw new Error('identity lost a source pixel');
// Translation must move the centroid without a directional stamping bias.
const moved=applySimilarity(src,W,H,center,center,0,1,7,-4), cm=centroid(moved,W), cs=centroid(src,W);
if(!near([cm[0]-cs[0],cm[1]-cs[1]],[7,-4],0.15)) throw new Error('translation centroid incorrect: '+cm);
// 90-degree rotation must rotate the line directions around the shared centre.
const rotated=applySimilarity(src,W,H,center,center,90,1,0,0);
if(rotated.reduce((a,v)=>a+v,0)<100) throw new Error('rotation dropped too much thin geometry');
const rp=points(rotated,W), minX=Math.min(...rp.map(p=>p[0])), maxX=Math.max(...rp.map(p=>p[0]));
if(maxX-minX<45) throw new Error('rotation output bounds are implausibly narrow');
// Down-scaling must retain thin geometry through inverse supersampling.
const scaled=applySimilarity(src,W,H,center,center,0,.6,0,0);
if(scaled.reduce((a,v)=>a+v,0)<45) throw new Error('down-scale lost thin geometry');
console.log('PASS identity, translation, 90-degree rotation, and thin-line down-scale');
