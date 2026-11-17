// Presentation only: retain the original source record unchanged.
function clean(text) {
  return String(text || '').replace(/^\s*(?:[-*•+]\s+|\d+[.)、]\s*)/, '').trim();
}
function sourcePresentation(recipe) {
  const steps=[];
  const sourceNotes=[];
  let heading='';
  for(const block of recipe.step_details){
    if(recipe.source_steps_structured){
      if(block.is_heading){heading=clean(block.instruction).replace(/^#{1,6}\s+/,'');continue;}
      if(/(?:Abstract Wrapper|extends CylindricalContainer|├──|└──)/.test(block.instruction)){
        sourceNotes.push(block.instruction);continue;
      }
      const instruction=clean(block.instruction).replace(/^\s*[-*•+]\s+/gm,'').trim();
      if(!instruction)continue;
      steps.push({...block,instruction,heading,open:false,materialText:(block.materials||[]).join('、')});
      heading='';continue;
    }
    const firstStep=steps.length;
    const lines=block.instruction.split(/\r?\n/).filter(line=>line.trim());
    if(/(?:Abstract Wrapper|extends CylindricalContainer|├──|└──)/.test(block.instruction)){
      sourceNotes.push(block.instruction);continue;
    }
    if(lines.every(line=>/^\s*(?:#{1,6}|`{3,}[^`]*|~{3,}|[-*_]{3,})\s*$/.test(line)))continue;
    const numbered=lines.some(line=>/^\s*\d+[.)、]\s*/.test(line));
    const bulleted=lines.some(line=>/^\s*[-*•+]\s+/.test(line));
    if(!numbered && lines.length===1 && /^\s*#{1,6}\s+/.test(lines[0])){
      heading=lines[0].replace(/^\s*#{1,6}\s+/,'');continue;
    }
    for(const line of numbered||bulleted?lines:[block.instruction]){
      if(/^\s*#{1,6}\s+/.test(line)){heading=line.replace(/^\s*#{1,6}\s+/,'');continue;}
      const continuation=(numbered||bulleted)&&!/^\s*(?:\d+[.)、]|[-*•+])\s*/.test(line)&&steps.length>firstStep&&!heading;
      if(continuation){steps[steps.length-1].instruction+='\n'+clean(line);continue;}
      const instruction=clean(line);if(!instruction)continue;
      steps.push({...block,instruction,heading,open:false,materialText:(block.materials||[]).join('、')});heading='';
    }
  }
  let stepNumber=0;
  for(const step of steps){
    if(step.heading)stepNumber=0;
    step.stepNumber=++stepNumber;
  }
  return {
    steps,
    sourceFoods:recipe.source_foods||recipe.ingredient_items.filter(item=>item.optional!==true).map(item=>item.name),
    sourceOptional:[...new Set((recipe.source_optional_ingredients||[]).map(item=>typeof item==='string'?item:item.name).filter(Boolean))],
    sourceSeasonings:(recipe.source_seasonings||recipe.seasonings).filter(name=>name!=='按原谱配料说明'),
    sourceAmounts:recipe.source_calculation.split(/\r?\n/).map(clean).filter(Boolean),
    sourceNotes:sourceNotes.join('\n\n')
  };
}
module.exports={sourcePresentation};
