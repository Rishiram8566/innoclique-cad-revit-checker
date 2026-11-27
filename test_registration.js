'use strict';
const fs=require('fs');const html=fs.readFileSync(__dirname+'/index.html','utf8');
function extractFunction(name){
  const marker='function '+name+'(';let start=html.indexOf(marker);if(start<0)throw new Error('Missing '+name);
  let brace=html.indexOf('{',start),depth=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<html.length;i++){const c=html[i],n=html[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}if(q){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===q)q=null;continue;}if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return html.slice(start,i+1);}
  throw new Error('Unclosed '+name);
}
const code=[
  'const rng=(a,b,st)=>{const o=[];for(let v=a;v<=b+1e-9;v+=st)o.push(v);return o;};',
  extractFunction('dil'),extractFunction('dist'),extractFunction('downMask'),extractFunction('ptsOf'),extractFunction('chanceOf'),extractFunction('regPair'),extractFunction('regSearch'),extractFunction('orientOf'),extractFunction('rotationHints'),extractFunction('suppressDense'),extractFunction('applySimilarity'),
  `function maskBounds(m,W,H){let x0=W,y0=H,x1=-1,y1=-1,n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(m[y*W+x]){n++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return n?{x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2,n}:null;}`,
  extractFunction('similarityRegister'),extractFunction('registrationOptions'),
  `return {similarityRegister,applySimilarity,maskBounds,registrationOptions};`
].join('\n');
const api=new Function(code)();
if(!html.includes('similarityRegister(mA,mB,W,H,registrationOptions(geo,cell))'))throw new Error('production core does not forward calibration options to similarity registration');
const W=512,H=512;
function line(m,x0,y0,x1,y1){let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,e=dx+dy;for(;;){m[y0*W+x0]=1;if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
const cad=new Uint8Array(W*H);
// Plan-like orthogonal outline and partitions, with unequal spans to disambiguate orientation.
line(cad,90,80,410,80);line(cad,410,80,410,420);line(cad,410,420,90,420);line(cad,90,420,90,80);
line(cad,210,80,210,260);line(cad,210,300,210,420);line(cad,90,250,210,250);
line(cad,210,180,410,180);line(cad,300,180,300,420);line(cad,300,310,410,310);
line(cad,140,80,140,150);line(cad,140,150,210,150);line(cad,350,310,350,420);
const cb=api.maskBounds(cad,W,H);
// Generate a Revit raster that is rotated, scaled and shifted relative to CAD.
const rev=api.applySimilarity(cad,W,H,{cx:cb.cx+9,cy:cb.cy-6},cb,-17,.94,3,-2);
const result=api.similarityRegister(cad,rev,W,H,{cell:.1,scaleKnown:false});
console.log(JSON.stringify({used:result.used,angle:result.angle,scale:result.scale,confidence:result.confidence,shift:result.shift,mode:result.mode},null,2));
if(!result.used)throw new Error('registration failed on controlled synthetic transform');
if(Math.abs(result.angle-17)>4)throw new Error('rotation estimate outside tolerance');
if(Math.abs(result.scale-(1/.94))>.10)throw new Error('scale estimate outside tolerance');
console.log('PASS controlled rotation/scale/translation registration');

// A drawing with an authoritative physical calibration must not be rescaled
// by the registration fallback: only rotation and translation may be solved.
const revFixed=api.applySimilarity(cad,W,H,{cx:cb.cx+7,cy:cb.cy-4},cb,-13,1,2,-3);
const fixed=api.similarityRegister(cad,revFixed,W,H,{cell:.1,scaleKnown:true,scaleLocked:true});
if(!fixed.used)throw new Error('locked-scale registration failed on controlled transform');
if(Math.abs(fixed.scale-1)>1e-9)throw new Error('known calibrated scale was changed: '+fixed.scale);
if(Math.abs(fixed.angle-13)>4)throw new Error('locked-scale rotation estimate outside tolerance: '+fixed.angle);
if(!fixed.scaleLocked)throw new Error('registration did not report locked scale');
console.log('PASS calibrated-scale lock preserves 1.0 scale while solving rotation/translation');


// Verify the production core forwards authoritative calibration into the solver.
const forwarded=api.registrationOptions({scaleKnown:true,scaleLocked:true},0.025);
if(!forwarded.scaleKnown||!forwarded.scaleLocked)throw new Error('core registration options dropped calibrated scale lock');
if(forwarded.cell!==0.025)throw new Error('core registration options dropped raster cell size');
const unlocked=api.registrationOptions({scaleKnown:false,scaleLocked:false},0.05);
if(unlocked.scaleLocked)throw new Error('unlocked registration unexpectedly locks scale');
console.log('PASS production core forwards calibrated scale lock to registration solver');
