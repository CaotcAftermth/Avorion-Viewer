import {BLOCK_DEFINITIONS,MATERIALS,ORIENTATIONS} from './block-model.js';
import {boxTypes} from './avorion/lib/geometry/boxInstances.js';
import {wedgeTypes} from './avorion/lib/geometry/wedgeInstances.js';

export const presets={smoke:1000,small:10000,medium:100000,'station-xl':500000,'station-xxl':1000000,megastructure:2000000,extreme:5000000};
const canonical='2:44,100:32,150:9,151:12,8:3';
const adversarial='101:22,102:18,103:12,10:8,13:9,170:9,114:12,108:10';
const types=new Set(BLOCK_DEFINITIONS.map(b=>b.typeIndex)), orientations=new Map(ORIENTATIONS.map(o=>[o.look+'/'+o.up,o]));
const axes=['x','y','z'], boundsKeys=['lx','ly','lz','ux','uy','uz'];
const emptyBounds=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
const updateBounds=(bounds,b)=>axes.forEach((_,i)=>{bounds.min[i]=Math.min(bounds.min[i],+b[i]);bounds.max[i]=Math.max(bounds.max[i],+b[i+3]);});
export const valueOptions=['profile','preset','blocks','seed','source','output','types','materials','orientations','dimensions','pitch','gap','module-side','unsupported-percent'];
function number(raw,name,min,max,integer=false){
  const n=Number(raw);
  if(!String(raw).trim()||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isSafeInteger(n)))throw Error('Invalid '+name+': '+raw);
  return n;
}
function weights(text,name,convert){
  const entries=text.split(',').map(pair=>{
    const [key,raw,extra]=pair.split(':');
    if(raw===undefined||extra!==undefined)throw Error('Invalid '+name+' entry: '+pair);
    return [convert(key),number(raw,name+' weight',Number.MIN_VALUE,1e9)];
  });
  const total=entries.reduce((sum,[,n])=>sum+n,0);
  return u=>{let pick=u*total;for(const [key,n] of entries){pick-=n;if(pick<0)return key;}return entries.at(-1)[0];};
}
export function fixtureOptions(v,argv=[]){
  const profile=v.profile??'canonical';
  if(!['canonical','canonical-mixed','canonical-uniform','adversarial','station-replica'].includes(profile))throw Error('Unknown profile: '+profile);
  if(v.preset&&!Object.hasOwn(presets,v.preset))throw Error('Unknown preset: '+v.preset);
  if(v.blocks!==undefined&&v.preset)throw Error('Choose --blocks or --preset.');
  const blocks=number(v.blocks??(v.preset?presets[v.preset]:presets.smoke),'block count',1,2147483647,true);
  if(profile==='station-replica'?!v.source:!!v.source)throw Error('--source is required and supported only for station-replica.');
  const procedural=['types','materials','orientations','dimensions','pitch','module-side','unsupported-percent'];
  if(profile==='station-replica'&&procedural.some(key=>v[key]!==undefined))throw Error('Station replication preserves source attributes. Use --gap to set spacing.');
  if(profile!=='station-replica'&&v.gap!==undefined)throw Error('--gap applies to station replication.');
  if(profile!=='adversarial'&&v['unsupported-percent']!==undefined)throw Error('--unsupported-percent applies to adversarial.');
  const ranges=(v.dimensions??'.5:1.5').split(':').map(a=>number(a,'dimension',.0001,100000));
  if(ranges.length!==2||ranges[1]<ranges[0])throw Error('--dimensions requires MIN:MAX.');
  const pitch=number(v.pitch??Math.max(4,Math.ceil(ranges[1]*2)),'pitch',.001,1e6);
  if(pitch<ranges[1]*2)throw Error('--pitch must be at least twice the maximum dimension.');
  return {profile,blocks,seed:number(v.seed??42,'seed',0,4294967295,true),source:v.source,
    output:v.output??'output/stress/'+profile+'-'+blocks+'.xml',gap:number(v.gap??16,'gap',1,1e6,true),
    typeWeights:v.types??canonical,materialWeights:v.materials??(profile==='canonical-uniform'?'0:1':'0:3,3:2,5:5'),
    orientationWeights:v.orientations??ORIENTATIONS.map(o=>o.look+'/'+o.up+':1').join(','),
    dimensions:ranges,pitch,moduleSide:number(v['module-side']??32,'module side',8,128,true),
    unsupportedPercent:number(v['unsupported-percent']??15,'unsupported percent',0,100),argv};
}

function attributes(text){
  const values={};
  const pattern=/\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/gy;
  let end=0,m;
  while((m=pattern.exec(text))){end=pattern.lastIndex;if(Object.hasOwn(values,m[1]))throw Error('Duplicate XML attribute '+m[1]);values[m[1]]=m[2]??m[3];}
  if(text.slice(end).trim())throw Error('Unsupported or malformed native XML attributes.');
  return values;
}
const legacyKeys=['lowerX','lowerY','lowerZ','upperX','upperY','upperZ'];
function blockRecord(a){
  const bounds=boundsKeys.map((key,i)=>a[key]??a[legacyKeys[i]]);
  if(bounds.some(v=>v===undefined||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(v)||!Number.isFinite(+v))||
      axes.some((_,i)=>!(+bounds[i+3]>+bounds[i])||!Number.isFinite(bounds[i+3]-bounds[i])))throw Error('Block requires finite positive extents.');
  const type=number(a.index??'','block type',0,2147483647,true);
  const material=number(a.material??0,'material',0,MATERIALS.length-1,true);
  const look=number(a.look??1,'look',0,5,true),up=number(a.up??3,'up',0,5,true);
  if(!types.has(type)||!orientations.has(look+'/'+up))throw Error('Unsupported block type or invalid orientation: '+type+' '+look+'/'+up);
  const color=a.color??'ff808080',secondary=a.secondaryColor;
  if(!/^[\da-f]{8}$/i.test(color)||(secondary!==undefined&&!/^[\da-f]{8}$/i.test(secondary)))throw Error('Invalid native ARGB color.');
  return {bounds,type,material,look,up,color,secondary};
}

// Read the native single-plan dialect emitted by the generator and the station.
// Ignore metadata outside the hull plan, including embedded turret designs.
export async function* readHullStream(stream,{onBytes}={}){
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const stack=[];
  let buffer='',item,planSeen=false,inPlan=false,rootSeen=false;
  for await(const chunk of stream){
    onBytes?.(chunk);
    buffer+=decoder.decode(chunk,{stream:true});
    let cursor=0;
    for(;;){
      const start=buffer.indexOf('<',cursor);
      if(start<0)break;
      if(buffer.slice(cursor,start).trim()&&(inPlan||!stack.length))throw Error('Unexpected text outside a native XML element.');
      const comment=buffer.startsWith('<!--',start), declaration=buffer.startsWith('<?',start);
      const marker=comment?'-->':declaration?'?>':'>';
      let end;
      if(comment||declaration)end=buffer.indexOf(marker,start+1);
      else {
        let quote;
        for(end=start+1;end<buffer.length;end++){
          const ch=buffer[end];
          if(quote){if(ch===quote)quote=undefined;}
          else if(ch==='"'||ch==="'")quote=ch;
          else if(ch==='>')break;
        }
        if(end===buffer.length)end=-1;
      }
      if(end<0){cursor=start;break;}
      cursor=end+marker.length;
      if(comment||declaration)continue;
      const token=buffer.slice(start+1,end);
      const match=/^(\/?)([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)$/.exec(token);
      if(!match)throw Error('Unsupported XML declaration or malformed tag.');
      const [,closing,tag,attrs,self]=match;
      const parent=stack.at(-1);
      if(closing){
        if(attrs.trim()||self||stack.pop()!==tag)throw Error('Mismatched closing tag: '+tag);
        if(tag==='item'&&inPlan&&stack.at(-1)==='plan'){
          if(!item?.block)throw Error('Hull item missing block.');
          yield {...item.block,index:item.index,parent:item.parent};
          item=undefined;
        }
        if(tag==='plan'&&inPlan&&stack.length<=1)inPlan=false;
        continue;
      }
      if(!stack.length){
        if(rootSeen||!['ship_design','ship','plan'].includes(tag))throw Error('Expected one native ship_design, ship, or plan document.');
        rootSeen=true;
      }
      if(tag==='plan'&&(stack.length===0||stack.length===1&&['ship_design','ship'].includes(parent))){
        if(planSeen||self)throw Error('Expected one nonempty hull plan.');
        planSeen=inPlan=true;
      }else if(inPlan){
        if(tag==='item'&&parent==='plan'&&!self){
          const a=attributes(attrs);
          item={index:number(a.index??'','item index',0,2147483647,true),parent:number(a.parent??-1,'parent index',-1,2147483647,true)};
        }else if(tag==='block'&&parent==='item'&&item&&!item.block)item.block=blockRecord(attributes(attrs));
        else throw Error('Unsupported nested hull element: '+tag);
      }
      if(!self)stack.push(tag);
    }
    buffer=buffer.slice(cursor);
    if(buffer.length>65536)throw Error('XML tag or text exceeds the supported 64 KiB token limit.');
  }
  buffer+=decoder.decode();
  if(!planSeen||stack.length||buffer.trim())throw Error('Incomplete native hull XML.');
}

async function sourcePlan(rows,sourceInfo){
  const records=[],ids=new Map(),bounds=emptyBounds();
  for await(const b of rows){
    if(ids.has(b.index))throw Error('Duplicate item index: '+b.index);
    ids.set(b.index,records.length);records.push(b);updateBounds(bounds,b.bounds);
  }
  const children=new Map(),roots=[];
  for(const [i,b] of records.entries()){
    if(b.parent===-1){roots.push(i);continue;}
    const parent=ids.get(b.parent);
    if(parent===undefined)throw Error('Missing parent '+b.parent+' for item '+b.index);
    const list=children.get(parent)??[];
    list.push(i);children.set(parent,list);
  }
  if(roots.length!==1)throw Error('Source requires exactly one root. Found '+roots.length+'.');
  const order=[roots[0]],remap=new Int32Array(records.length);
  for(let cursor=0;cursor<order.length;cursor++){
    const i=order[cursor];remap[i]=cursor;
    for(const child of children.get(i)??[])order.push(child);
  }
  if(order.length!==records.length)throw Error('Source hierarchy contains a cycle or disconnected component.');
  return {records:order.map(i=>({...records[i],parent:records[i].parent===-1?-1:remap[ids.get(records[i].parent)]})),
    bounds,source:{...sourceInfo(),blocks:records.length}};
}

// Integer offsets leave the source decimal's fractional precision intact.
export function translate(value,offset){
  if(!offset)return value;
  const [mantissa,exponent='0']=value.toLowerCase().split('e');
  const [integer,fraction='']=mantissa.replace(/^[-+]/,'').split('.');
  const power=Number(exponent)-fraction.length;
  if(Math.abs(power)>350)throw Error('Source coordinate exponent is outside supported range.');
  const sign=mantissa.startsWith('-')?-1n:1n;
  const digits=sign*BigInt((integer+fraction)||'0');
  if(power>=0)return String(digits*10n**BigInt(power)+BigInt(offset));
  const divisor=10n**BigInt(-power),sum=digits+BigInt(offset)*divisor,abs=sum<0n?-sum:sum;
  const decimals=String(abs%divisor).padStart(-power,'0').replace(/0+$/,'');
  return (sum<0n?'-':'')+String(abs/divisor)+(decimals?'.'+decimals:'');
}

function randomAt(seed,i,channel){
  let x=(seed+Math.imul(i+1,0x9e3779b1)+Math.imul(channel+1,0x85ebca77))|0;
  x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/4294967296;
}
export async function planFixture(config,rows,sourceInfo){
  if(config.source){
    const {records,bounds,source}=await sourcePlan(rows,sourceInfo),size=records.length;
    const step=Math.ceil(bounds.max[0]-bounds.min[0])+config.gap;
    const modules=Math.ceil(config.blocks/size);
    if(!Number.isSafeInteger(step*modules))throw Error('Replication offsets exceed safe integer range.');
    return {source,replication:{fullModules:Math.floor(config.blocks/size),partialBlocks:config.blocks%size,fillerBlocks:0,
      offsetRule:[step,0,0],moduleCount:modules,order:'breadth-first ancestor-closed prefix',parentPolicy:'copy roots attach to item 0 across physical gaps'},
      *rows(){for(let index=0;index<config.blocks;index++){
        const local=index%size,base=index-local,b=records[local];
        const bounds=base?b.bounds.map((n,i)=>i%3===0?translate(n,(base/size)*step):n):b.bounds;
        yield {...b,index,parent:local?base+b.parent:index?0:-1,bounds};
      }}};
  }
  const type=weights(config.typeWeights,'type',n=>{
    const index=Number(n);if(!boxTypes.has(index)&&!wedgeTypes.has(index))throw Error('Type is outside the canonical allowlist: '+n);return index;
  });
  const unsupported=weights(adversarial,'unsupported type',Number);
  const material=weights(config.materialWeights,'material',n=>number(n,'material',0,MATERIALS.length-1,true));
  const orientation=weights(config.orientationWeights,'orientation',n=>{
    if(!orientations.has(n))throw Error('Invalid orientation: '+n);return orientations.get(n);
  });
  const uniform=config.profile==='canonical-uniform',adverse=config.profile==='adversarial';
  const side=config.moduleSide, pitch=config.pitch, tiles=side*side;
  const [min,max]=config.dimensions,seed=config.seed;
  return {*rows(){for(let index=0;index<config.blocks;index++){
    const r=channel=>randomAt(seed,index,channel);
    const module=Math.floor(index/tiles),local=index%tiles,col=local%side,row=Math.floor(local/side);
    const arm=module%4,section=Math.floor(module/4);
    // Four panel arrays around a longitudinal spine. Root links can span gaps.
    const x=section*(side+2)*pitch+col*pitch;
    const y=(arm===0?row:arm===1?-row:arm===2?side:-side)*pitch;
    const z=(arm<2?(arm===0?1:-1):row-side/2)*pitch;
    const bounds=[x,y,z],upper=[];
    for(let axis=0;axis<3;axis++){
      let extent=uniform?min+(max-min)*.5:min+(max-min)*r(4+axis);
      if(adverse&&index%13===0)extent=axis===1?Math.max(.0001,min*.012):max*1.9;
      const half=Math.round(extent*512)/1024||.00005;
      upper.push(bounds[axis]+half);bounds[axis]-=half;
    }
    const kind=adverse&&((index+1)*config.unsupportedPercent/100|0)>(index*config.unsupportedPercent/100|0)?unsupported(r(0)):type(r(0));
    const {look,up}=orientation(r(2));
    const primary=['ff526578','ff869ca9','ff343c46','ffb39c78'];
    yield {index,parent:index===0?-1:local?index-(col?1:side):0,bounds:[...bounds,...upper].map(String),
      type:kind,material:material(r(1)),look,up,color:primary[Math.floor(r(3)*primary.length)],
      secondary:wedgeTypes.has(kind)||kind===150?'804b9cff':undefined};
  }}};
}

const count=(out,key)=>{out[key]=(out[key]??0)+1;};
export function serializeFixture(config,plan,{signal,progress=()=>{}}={}){
  const bounds=emptyBounds(),dimensionRange=emptyBounds(),blockTypes={},materials={},orientationCounts={};
  let actualBlocks=0,canonicalFamilies=0,rootCount=0;
  async function* chunks(){
    let chunk='<ship_design>\n<plan accumulateHealth="true" convex="false">\n';
    for(const b of plan.rows()){
      if(b.index!==actualBlocks||b.parent>=b.index||b.parent< -1||b.parent===-1&&b.index!==0)throw Error('Invalid generated hierarchy at '+b.index);
      if(b.parent===-1)rootCount++;
      if(b.bounds.some(n=>!Number.isFinite(+n))||axes.some((_,i)=>!(+b.bounds[i+3]>+b.bounds[i])))throw Error('Translation or layout collapsed bounds at '+b.index);
      count(blockTypes,b.type);count(materials,b.material);count(orientationCounts,b.look+'/'+b.up);
      canonicalFamilies+=Number(boxTypes.has(b.type)||wedgeTypes.has(b.type));
      updateBounds(bounds,b.bounds);
      for(let i=0;i<3;i++){const d=b.bounds[i+3]-b.bounds[i];dimensionRange.min[i]=Math.min(dimensionRange.min[i],d);dimensionRange.max[i]=Math.max(dimensionRange.max[i],d);}
      chunk+='<item index="'+b.index+'" parent="'+b.parent+'"><block '+boundsKeys.map((key,i)=>key+'="'+b.bounds[i]+'"').join(' ')+
        ' index="'+b.type+'" material="'+b.material+'" look="'+b.look+'" up="'+b.up+'" color="'+b.color+'"'+
        (b.secondary===undefined?'':' secondaryColor="'+b.secondary+'"')+'/></item>\n';
      actualBlocks++;
      if(actualBlocks%1024===0){yield chunk;chunk='';signal?.throwIfAborted();}
      if(actualBlocks%100000===0)progress(actualBlocks);
    }
    if(actualBlocks!==config.blocks||rootCount!==1)throw Error('Generated count or root validation failed.');
    yield chunk+'</plan>\n</ship_design>\n';
  }
  return {chunks,manifest(name,evidence){
    return {generatorVersion:1,name,profile:config.profile,seed:config.seed,requestedBlocks:config.blocks,actualBlocks,
      source:plan.source,replication:plan.replication,blockTypes,materials,orientations:orientationCounts,expectedCanonicalFamilyBlocks:canonicalFamilies,
      unsupportedFamilyBlocks:actualBlocks-canonicalFamilies,rootCount,parentValidation:{uniqueSequentialIndices:true,allParentsEarlier:true,cycles:0},
      bounds,dimensionRange,generationOptions:config,...evidence};
  }};
}
