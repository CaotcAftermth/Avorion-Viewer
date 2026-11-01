// Minimal silent VP8/WebM muxing. One timestamped cluster per encoded frame.
const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
const hex=s=>Uint8Array.from(s.match(/../g).map(x=>parseInt(x,16)));
function size(n){for(let bytes=1;bytes<=8;bytes++)if(n<2**(7*bytes)-1){const a=new Uint8Array(bytes);for(let i=bytes-1;i>=0;i--){a[i]=n%256;n=Math.floor(n/256);}a[0]|=1<<(8-bytes);return a;}throw Error('WebM element too large.');}
const element=(id,data)=>concat([hex(id),size(data.length),data]),uint=n=>{const bytes=[];do{bytes.unshift(n%256);n=Math.floor(n/256);}while(n);return Uint8Array.from(bytes);},u=(id,n)=>element(id,uint(n)),str=(id,s)=>element(id,new TextEncoder().encode(s));
export function webmMux(frames,width,height,fps){const number=new Uint8Array(8);new DataView(number.buffer).setFloat64(0,frames.length/fps*1000);
 const header=element('1a45dfa3',concat([u('4286',1),u('42f7',1),u('42f2',4),u('42f3',8),str('4282','webm'),u('4287',2),u('4285',2)]));
 const info=element('1549a966',concat([u('2ad7b1',1000000),str('4d80','Avorion Viewer'),str('5741','Avorion Viewer'),element('4489',number)]));
 const tracks=element('1654ae6b',element('ae',concat([u('d7',1),u('73c5',1),u('83',1),str('86','V_VP8'),u('23e383',Math.round(1e9/fps)),element('e0',concat([u('b0',width),u('ba',height)]))])));
 const clusters=frames.map(f=>element('1f43b675',concat([u('e7',Math.round(f.timestamp/1000)),element('a3',concat([Uint8Array.of(0x81,0,0,f.key?0x80:0),f.data]))])));
 return new Blob([header,hex('18538067'),size(info.length+tracks.length+clusters.reduce((n,c)=>n+c.length,0)),info,tracks,...clusters],{type:'video/webm'});
}
export async function webmSupported(width=1280,height=720,fps=30){if(typeof VideoEncoder==='undefined')return false;try{return (await VideoEncoder.isConfigSupported({codec:'vp8',width,height,framerate:fps,bitrate:6000000})).supported;}catch{return false;}}
