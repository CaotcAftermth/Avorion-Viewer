import {gifPalette} from './gif-palette.js';
// GIF89a with adaptive frame palettes and bounded LZW tables.
// Frames are compressed immediately; raw frame buffers are never accumulated.
export class GifEncoder {
  constructor(width,height,background=null,transparent=false,loop=true){
    this.width=width;this.height=height;this.parts=[];this.bytes=0;
    this.transparent=transparent;
    this.background=background?[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)):null;
    const header=[...new TextEncoder().encode('GIF89a'),width&255,width>>8,height&255,height>>8,0xf7,transparent?255:0,0];
    for(let i=0;i<256;i++)header.push(Math.round((i>>5)*255/7),Math.round(((i>>2)&7)*255/7),(i&3)*85);
    if(this.background)header.splice(13+255*3,3,...this.background);
    if(loop)header.push(0x21,0xff,11,...new TextEncoder().encode('NETSCAPE2.0'),3,1,0,0,0);
    this.push(Uint8Array.from(header));
  }
  push(bytes){this.parts.push(bytes);this.bytes+=bytes.length;}
  addFrame(rgba,delay){
    const {pixels,palette}=gifPalette(rgba,this.background,this.transparent);
    // Transparent frames restore the clear background before the next frame,
    // so rotating geometry cannot leave trails in previously occupied pixels.
    this.push(Uint8Array.from([0x21,0xf9,4,this.transparent?9:4,delay&255,delay>>8,this.transparent?255:0,0,0x2c,0,0,0,0,this.width&255,this.width>>8,this.height&255,this.height>>8,0x87]));
    this.push(palette);this.push(Uint8Array.of(8));
    const data=lzw(pixels),blocks=[];
    for(let i=0;i<data.length;i+=255){const part=data.subarray(i,i+255);blocks.push(Uint8Array.of(part.length),part);}
    for(const block of blocks)this.push(block);this.push(Uint8Array.of(0));
  }
  finish(){return new Blob([...this.parts,Uint8Array.of(0x3b)],{type:'image/gif'});}
}
function lzw(pixels){
  const output=[];let bits=0,buffer=0,size=9,next=258,table=new Map();
  const emit=code=>{buffer|=code<<bits;bits+=size;while(bits>=8){output.push(buffer&255);buffer>>>=8;bits-=8;}};
  emit(256);let prefix=pixels[0];
  for(let i=1;i<pixels.length;i++){
    const value=pixels[i],key=prefix*256+value,found=table.get(key);
    if(found!==undefined){prefix=found;continue;}
    emit(prefix);
    // Decoder creates dictionary entries one emitted code behind the encoder.
    if(next===(1<<size)&&size<12)size++;
    if(next<4096)table.set(key,next++);
    else{emit(256);table=new Map();size=9;next=258;}
    prefix=value;
  }
  emit(prefix);if(next===(1<<size)&&size<12)size++;emit(257);
  if(bits)output.push(buffer&255);return Uint8Array.from(output);
}
