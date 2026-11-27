'use strict';
/* v29 precision upgrade regression tests (synthetic data only; run: node test_v29_precision.js)
   1. PDF intelligence recognises AutoCAD plots, Revit exports and scans
   2. vector alignment recovers a known rotation + shift to sub-millimetre, with the scale held
   3. a wall moved 300 mm is reported as exactly 300 mm at the right place; a removed wall as missing
   4. DXF reader: paper space left out, viewport read, mirrored (OCS) objects, splines, 2D solids, dimensions
   5. dashed lines are judged as whole runs, so a dashed line survives the short-stroke filter */
const fs=require('fs');const html=fs.readFileSync(__dirname+'/index.html','utf8');
function extractFunction(name){
  const marker='function '+name+'(';let start=html.indexOf(marker);if(start<0)throw new Error('Missing '+name);
  let brace=html.indexOf('{',start),depth=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<html.length;i++){const c=html[i],n=html[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}if(q){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===q)q=null;continue;}if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return html.slice(start,i+1);}
  throw new Error('Unclosed '+name);}
const pure=html.slice(html.indexOf('/*PURE_START*/'),html.indexOf('/*PURE_END*/'));
const body=[extractFunction('otsu'),extractFunction('ccl'),extractFunction('rectsOf'),'const $=()=>null;',pure,
  ...['cleanComparisonMask','maskBounds','strokeWidth','cleanRaster'].map(extractFunction),
  html.slice(html.indexOf('const PDF_CALIBRATIONS='),html.indexOf('function pdfCalibrationFor'))].join('\n');
const api=new Function(body+'\nreturn {makeParser,pdfSourceOf,icpRegister,coarseAlign,Tsegs,segBox,v29Compare,mainGeometry,trimBox,viewportOf,skipLayer,dropTextStrokes};')();
let fails=0;const ok=(c,m)=>{if(c)console.log('PASS',m);else{fails++;console.log('FAIL',m);}};

/* 1. PDF intelligence */
{const cad=api.pdfSourceOf({creator:'AutoCAD 2024 - English 2024',producer:'pdfplot16.hdi 16.03.061.00000',layers:['0','A-ARCH-WALL','XREF_X$0$A-ARCH-DOOR'],annots:{total:900,shx:900},stats:{paths:2e5,images:0}});
  ok(cad.kind==='cad'&&/AutoCAD 2024/.test(cad.app),'AutoCAD plot recognised as a CAD drawing ('+cad.label+')');
  const rv=api.pdfSourceOf({creator:'Autodesk Revit 2024',title:'Sheet: A101 - GROUND FLOOR PLAN',layers:[],text:'PROJECT NUMBER PROJECT NAME DRAWN BY CHECKED BY ISSUE DATE',stats:{paths:3000,images:0}});
  ok(rv.kind==='revit','Revit sheet export recognised as Revit ('+rv.label+')');
  const rl=api.pdfSourceOf({producer:'Bluebeam PDF Library',layers:['Walls','Doors','Windows','Grids','Floors'],stats:{paths:4000,images:0}});
  ok(rl.kind==='revit','Revit category layers recognised as Revit');
  const sc=api.pdfSourceOf({producer:'Scanner',layers:[],stats:{paths:3,images:1,imageArea:9e5},pageArea:1e6});
  ok(sc.kind==='raster','scanned sheet recognised as raster');}

/* a plan-like set of double-line walls (metres) */
function plan(){const S=[],wall=(x0,y0,x1,y1,t)=>{if(y0===y1){S.push(x0,y0-t/2,x1,y1-t/2,x0,y0+t/2,x1,y1+t/2,x0,y0-t/2,x0,y0+t/2,x1,y1-t/2,x1,y1+t/2);}else{S.push(x0-t/2,y0,x1-t/2,y1,x0+t/2,y0,x1+t/2,y1,x0-t/2,y0,x0+t/2,y0,x1-t/2,y1,x1+t/2,y1);}};
  wall(0,0,40,0,.3);wall(0,25,40,25,.3);wall(0,0,0,25,.3);wall(40,0,40,25,.3);wall(12,0,12,25,.2);wall(12,10,40,10,.2);wall(26,10,26,25,.2);wall(0,16,12,16,.2);wall(31,0,31,10,.2);
  return Float64Array.from(S);}
/* 2. alignment */
{const A=plan(),th=23.5*Math.PI/180,T={a:Math.cos(th),b:Math.sin(th),tx:137.25,ty:-41.8},B=api.Tsegs(T,A);
  const c=api.coarseAlign(A,B,{}),R=api.icpRegister(A,B,c[0].T,{lockScale:true,r0:.6,rMin:.005});
  const err=Math.hypot(...(()=>{const p=[12.3,7.7],q=[R.T.a*(T.a*p[0]-T.b*p[1]+T.tx)-R.T.b*(T.b*p[0]+T.a*p[1]+T.ty)+R.T.tx,R.T.b*(T.a*p[0]-T.b*p[1]+T.tx)+R.T.a*(T.b*p[0]+T.a*p[1]+T.ty)+R.T.ty];return[q[0]-p[0],q[1]-p[1]];})());
  ok(Math.abs(R.angle+23.5)<.001&&err<.0005&&R.scale===1,'rotation 23.5 deg + shift recovered (angle '+R.angle.toFixed(5)+', point error '+(err*1000).toFixed(3)+' mm, scale held)');}

/* 3. planted 300 mm wall shift and a removed wall, through the whole comparison */
{const A=plan(),Bl=Array.from(A),mv=[],keep=[];
  for(let i=0;i<Bl.length;i+=4){const x0=Bl[i],y0=Bl[i+1],x1=Bl[i+2],y1=Bl[i+3];
    const inWall=(xa,xb,y,t)=>Math.min(x0,x1)>=xa-.01&&Math.max(x0,x1)<=xb+.01&&Math.min(y0,y1)>=y-t&&Math.max(y0,y1)<=y+t;
    if(inWall(12,40,10,.11)&&!(Math.abs(x0-x1)<1e-9&&Math.abs(x0-12)<.2)){mv.push(x0,y0+.3,x1,y1+.3);continue;}   /* move wall y=10 by +300 mm */
    if(inWall(0,12,16,.11)&&Math.abs(y0-y1)<1e-9)continue;                                                       /* remove the faces of wall y=16 */
    keep.push(x0,y0,x1,y1);}
  const Bm=Float64Array.from(keep.concat(mv));
  const rec=S=>{const n=S.length/4,x=new Float32Array(S.length);for(let i=0;i<S.length;i++)x[i]=S[i]*1000;return{P:{x,ly:new Uint16Array(n),n},names:['A-WALL'],counts:[n],ox:0,oy:0};};
  const a=rec(A),b=rec(Bm),on=new Uint8Array([1]),PA=api.mainGeometry(a.P,on,null,a.names),PB=api.mainGeometry(b.P,on,null,b.names);
  const out=api.v29Compare(a,b,PA,PB,on,on,api.trimBox(PA,on),api.trimBox(PB,on),.001,.001,{lod:'400',tol:.02,mainOnly:false,scaleKnown:true,scaleLocked:true});
  const is=out.r.issues,pos=is.find(s=>s.cat==='Position differs'),mis=is.find(s=>s.cat==='Missing in Revit');
  ok(pos&&Math.round(pos.offset[1]*1000)===300&&Math.abs(pos.offset[0])<.002,'moved wall reported as '+(pos?Math.round(pos.offset[0]*1000)+' / '+Math.round(pos.offset[1]*1000)+' mm':'nothing')+' (planted 0 / 300 mm)');
  ok(pos&&+String(pos.cadXY[1]).replace(/,/g,'')>9800&&+String(pos.cadXY[1]).replace(/,/g,'')<10400,'moved wall marker on the wall (CAD Y '+(pos&&pos.cadXY[1])+')');
  ok(mis&&/12\.\d\d m long|11\.\d\d m long/.test(mis.diff),'removed 12 m wall reported missing ('+(mis&&mis.diff)+')');}

/* 3b. a building drawn 400 mm wider (right outer wall moved out) is still reported as an overall size difference */
{const A=plan(),Bl=[];for(let i=0;i<A.length;i+=4){let x0=A[i],x1=A[i+2];if(x0>39.8&&x1>39.8){x0+=.4;x1+=.4;}else{if(x0>39.8)x0+=.4;if(x1>39.8)x1+=.4;}Bl.push(x0,A[i+1],x1,A[i+3]);}
  const rec=S=>{const n=S.length/4,x=new Float32Array(S.length);for(let i=0;i<S.length;i++)x[i]=S[i]*1000;return{P:{x,ly:new Uint16Array(n),n},names:['A-WALL'],counts:[n],ox:0,oy:0};};
  const a=rec(A),b=rec(Float64Array.from(Bl)),on=new Uint8Array([1]),PA=api.mainGeometry(a.P,on,null,a.names),PB=api.mainGeometry(b.P,on,null,b.names);
  const out=api.v29Compare(a,b,PA,PB,on,on,api.trimBox(PA,on),api.trimBox(PB,on),.001,.001,{lod:'300',tol:.05,mainOnly:false,scaleKnown:true,scaleLocked:true});
  const fp=out.r.issues.find(s=>s.cat==='Overall size');
  ok(fp&&/400 mm wider/.test(fp.diff),'building 400 mm wider reported as overall size ('+(fp?fp.diff:'not reported')+')');}

/* 3c. the page's own sample pair: wall moved 300 mm, wall 1.80 m shorter, extra 1.40 m wall - sizes must be exact */
{const api3=new Function(body+'\nreturn {sampleDXF,makeParser,mainGeometry,trimBox,v29Compare};')();
  const mk=rev=>{const p=api3.makeParser();p.pushText(api3.sampleDXF(rev),true);return p.finish();};
  const a=mk(false),b=mk(true),onA=Uint8Array.from(a.names,k=>/WALL/.test(k)?1:0),onB=Uint8Array.from(b.names,k=>/WALL/.test(k)?1:0);
  const PA=api3.mainGeometry(a.P,onA,null,a.names),PB=api3.mainGeometry(b.P,onB,null,b.names);
  const out=api3.v29Compare(a,b,PA,PB,onA,onB,api3.trimBox(PA,onA),api3.trimBox(PB,onB),.001,.001,{lod:'300',tol:.05,mainOnly:true,scaleKnown:true,scaleLocked:true});
  const is=out.r.issues,pos=is.find(s=>s.cat==='Position differs'),mis=is.find(s=>s.cat==='Missing in Revit'),ext=is.find(s=>s.cat==='Extra in Revit');
  ok(pos&&Math.round(Math.hypot(...pos.offset)*1000)===300&&mis&&/1\.80 m long/.test(mis.diff)&&ext&&/1\.40 m long/.test(ext.diff),
    'sample pair: '+(pos?Math.round(Math.hypot(...pos.offset)*1000)+' mm shift':'no shift')+', '+(mis?mis.diff:'no missing')+', '+(ext?ext.diff:'no extra'));}

/* 4. DXF reader */
{const P=api.makeParser();P.pushText(['0','SECTION','2','ENTITIES',
  '0','LINE','8','W','10','0','20','0','11','10','21','0',
  '0','LINE','8','FRAME','67','1','10','0','20','0','11','841','21','0',                      /* paper space: not model */
  '0','VIEWPORT','8','0','67','1','10','400','20','280','40','700','41','550','12','100','22','200','17','5000','27','3000','45','110000','69','2',
  '0','CIRCLE','8','W','10','5','20','0','40','1','210','0','220','0','230','-1',              /* mirrored: world x = -5 */
  '0','SPLINE','8','W','71','2','40','0','40','0','40','0','40','1','40','1','40','1','10','0','20','0','10','1','20','1','10','2','20','0',
  '0','SOLID','8','W','10','20','20','0','11','21','21','0','12','20','22','1','13','21','23','1',
  '0','ENDSEC','0','EOF',''].join('\n'),true);
  const r=P.finish(),X=r.P.x;let cx=[],sp=null,frame=false;
  for(let i=0;i<r.P.n;i++){const o=i*4,x0=X[o]+r.ox,y0=X[o+1]+r.oy,x1=X[o+2]+r.ox;if(x0<-3)cx.push(x0);const y1=X[o+3]+r.oy;if(x0>=0&&x1<=2&&x0<2&&y1>0)sp=Math.max(sp||0,y1);if(Math.abs(x1-841)<1)frame=true;}
  ok(!frame&&r.paper===1,'paper-space title block left out of the model');
  const vp=api.viewportOf(r);ok(vp&&Math.abs(vp.denom-200)<1e-6&&Math.abs(vp.cx-5100)<1e-6,'layout viewport read: 1:'+(vp&&vp.denom)+', window centre '+(vp&&vp.cx));
  ok(cx.length&&Math.min(...cx)>-6.01&&Math.max(...cx)<-3.99,'mirrored circle placed at world x -6..-4');
  ok(sp!==null&&Math.abs(sp-.5)<.02,'spline evaluated as a true B-spline (peak y '+(sp&&sp.toFixed(3))+', control polygon would give 1.0)');
  ok(r.P.n>=4+48+8,'solid outline and spline segments present');}

/* 5. dashed line: one CAD line vs 20 PDF dashes must be kept on both sides */
{const mk=S=>{const n=S.length/4;return{x:Float32Array.from(S),ly:new Uint16Array(n),n};};
  const solid=mk([0,0,10,0,0,5,100,5,100,5,100,0]),dash=[];for(let k=0;k<20;k++)dash.push(k*.5,0,k*.5+.3,0);dash.push(0,5,100,5,100,5,100,0);
  const on=new Uint8Array([1]),a=api.mainGeometry(solid,on,null,['0']),b=api.mainGeometry(mk(dash),on,null,['0'],a.minLen);
  ok(b.n===22,'dashed 10 m line kept as one run ('+b.n+' of 22 pieces kept)');}

/* dash gaps are not mismatches; a 0.9 m door opening is */
{const api2=new Function(body+'\nreturn {vectorMismatch};')();
  const cad=Float64Array.from([0,0,20,0]),dashes=[];for(let x=0;x<20;x+=1.3)dashes.push(x,0,Math.min(20,x+1),0);
  const v1=api2.vectorMismatch(cad,Float64Array.from(dashes),.05,{});
  ok(v1.recall>.999,'continuous CAD line vs dashed PDF line: '+(v1.recall*100).toFixed(1)+'% matched (gaps of 0.3 m bridged)');
  const door=Float64Array.from([0,0,9.5,0,10.4,0,20,0]),v2=api2.vectorMismatch(cad,door,.05,{});
  const miss=(1-v2.recall)*20;ok(miss>.8&&miss<1,'0.9 m door opening still reported ('+miss.toFixed(2)+' m of CAD line unmatched)');
  /* an axis line plotted as 2 m dashes with 2 m gaps: bridged on axis layers, never on wall layers */
  const ax=[];for(let x=0;x<20;x+=4)ax.push(x,0,Math.min(20,x+2),0);const axS=Float64Array.from(ax),one=new Uint8Array([1]),many1=new Uint8Array(ax.length/4).fill(1),many0=new Uint8Array(ax.length/4);
  const axis=Float64Array.from([0,0,18,0]),v3=api2.vectorMismatch(axis,axS,.05,{dashA:one,dashB:many1}),v4=api2.vectorMismatch(axis,axS,.05,{dashA:new Uint8Array([0]),dashB:many0});
  ok(v3.recall>.95&&v4.recall<.6,'2 m dash gaps bridged on axis layers ('+(v3.recall*100).toFixed(0)+'%), not on wall layers ('+(v4.recall*100).toFixed(0)+'%)');}

/* SHX text strokes inside an AutoCAD "SHX Text" box are removed, walls are kept */
{const rec={P:{x:Float32Array.from([10,10,12,10, 11,9,11,12, 0,0,100,0]),ly:new Uint16Array(3),n:3},counts:[3]};
  const n=api.dropTextStrokes(rec,[[9,8,13,13]]);ok(n===2&&rec.P.n===1,'SHX text strokes removed ('+n+'), wall line kept');}

if(fails){console.log(fails+' test(s) failed');process.exit(1);}console.log('All v29 precision tests passed');
