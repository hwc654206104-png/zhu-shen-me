// LZW over UTF-16 code units, varint codes, base64 transport. No eval or APIs.
function decompress(input) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', bytes=[];
  let bits=0,value=0;
  for(const ch of input){const n=alphabet.indexOf(ch);if(n<0)continue;value=(value<<6)|n;bits+=6;if(bits>=8){bits-=8;bytes.push((value>>bits)&255);}}
  const codes=[];let code=0,shift=0;
  for(const byte of bytes){code+=(byte&127)*Math.pow(2,shift);if(byte&128)shift+=7;else{codes.push(code);code=0;shift=0;}}
  if(shift||!codes.length)throw Error('INVALID_TEXT_DATA');
  const dictionary=[];let next=65536,previous=String.fromCharCode(codes[0]);const output=[previous];
  for(let i=1;i<codes.length;i++){
    const n=codes[i];const entry=n<65536?String.fromCharCode(n):dictionary[n]||(n===next?previous+previous[0]:null);
    if(entry===null)throw Error('INVALID_TEXT_CODE');
    output.push(entry);dictionary[next++]=previous+entry[0];previous=entry;
  }
  return output.join('');
}
module.exports={decompress};
