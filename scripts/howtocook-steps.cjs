// Keep each Markdown list item intact: indented lists and wrapped lines belong
// to their parent action, even when a blank line separates them in the source.
function parseOperation(operation, plain) {
 const details=[];
 let section='', current=null, fence=null;
 const flush=()=>{if(current){const instruction=plain(current.lines.join('\n'));if(instruction)details.push({instruction,minutes:null,heat:'按步骤原文',materials:[],section});current=null;}};
 for(const raw of operation.replace(/\r\n/g,'\n').split('\n')){
  const heading=raw.match(/^\s*(#{1,6})\s+(.+)$/);
  const fenceMatch=raw.match(/^\s*(`{3,}|~{3,})/);
  if(fence){current.lines.push(raw);if(fenceMatch&&fenceMatch[1][0]===fence){fence=null;flush();}continue;}
  if(fenceMatch){flush();fence=fenceMatch[1][0];current={lines:[raw],indent:null};continue;}
  if(heading){flush();section=plain(heading[2]);details.push({instruction:plain(raw),minutes:null,heat:'按步骤原文',materials:[],section,is_heading:true});continue;}
  if(!raw.trim()){if(current&&current.indent===null)flush();continue;}
  const item=raw.match(/^(\s*)(?:\d+[.)、]|[-*+•])\s+(.*)$/);
  if(item){
   const indent=item[1].replace(/\t/g,'    ').length;
   if(current&&current.indent!==null&&indent>current.indent){current.lines.push(raw);continue;}
   flush();current={lines:[raw],indent};continue;
  }
  // Paragraphs following a list item are its explanations, not new actions.
  if(!current)current={lines:[],indent:null};
  current.lines.push(raw);
 }
 flush();return details;
}
function isOptionalIngredient(line) {
 return /^[\s*+•-]*(?:主料|辅料|原料|配料)?\s*[:：]?\s*可选\s*[:：]/.test(line)||/[（(]\s*(?:可选|非必需|非必须)(?:[）)、，,：:\s]|$)/.test(line);
}
function optionalIngredientName(line, plain) {
 return plain(line).replace(/^\s*(?:[-+•*]|\d+[.)、])\s*/, '')
  .replace(/^(?:主料|辅料|原料|配料|可选)\s*[:：]\s*/, '')
  .replace(/^[（(]可选[）)]\s*/, '')
  .split(/[（(:：=＝0-9０-９¼½¾~]/)[0].trim();
}
module.exports={parseOperation,isOptionalIngredient,optionalIngredientName};
