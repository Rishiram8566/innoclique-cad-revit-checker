'use strict';
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
function extractFunction(name){
  const marker='function '+name+'(';let start=html.indexOf(marker);if(start<0)throw new Error('Missing '+name);
  let brace=html.indexOf('{',start),depth=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<html.length;i++){const c=html[i],n=html[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}if(q){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===q)q=null;continue;}if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return html.slice(start,i+1);}
  throw new Error('Unclosed '+name);
}
const code=`const SKIP=/(dim|text|anno|note|hatch|furn|grid|defpoints|title|tag|viewport|xref|symbol)/i;\n`+
  extractFunction('semanticLayerName')+'\n'+extractFunction('skipLayer')+'\nreturn {semanticLayerName,skipLayer};';
const {semanticLayerName,skipLayer}=new Function(code)();
const cases=[
  ['XREF_DXB_EMPDSP_DCP_BLL$0$A-ARCH-WALL',false],
  ['XREF_DXB_EMPDSP_DCP_BLL$0$A-ARCH-DOOR',false],
  ['XREF_DXB_EMPDSP_DCP_BLL$0$A-ARCH-STRC',false],
  ['XREF_DXB_EMPDSP_DCP_BLL$0$M-EQP-FIRE PUMPS',true],
  ['A-DIMENSIONS',true],
  ['A-WALL',false]
];
for(const [name,expected] of cases){const got=skipLayer(name);if(got!==expected)throw new Error(`${name}: expected skip=${expected}, got ${got}`);}
if(semanticLayerName('XREF_DXB_EMPDSP_DCP_BLL$0$A-ARCH-WALL')!=='A-ARCH-WALL')throw new Error('XREF semantic suffix was not extracted');
console.log('PASS XREF-aware wall/door/structure layer selection and annotation/equipment exclusion');
