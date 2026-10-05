import { getDocumentProxy } from 'unpdf';
import { normalizeText } from '../domain.mjs';
export async function extractPDF(bytes){
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Object.assign(Error('Selecione um PDF válido.'),{status:400});
 let pdf;
 try{
  pdf=await getDocumentProxy(bytes.slice(),{isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true});
  if(pdf.numPages>200)throw Object.assign(Error('O limite é 200 páginas por PDF.'),{status:413});
  const parts=[];let length=0;
  for(let n=1;n<=Math.min(pdf.numPages,30);n++){
   const page=await pdf.getPage(n),content=await page.getTextContent();let line='',lastY=null;
   for(const item of content.items){if(!('str'in item))continue;const y=item.transform?.[5];if(lastY!==null&&Math.abs(y-lastY)>3&&line){parts.push(line.trim());line='';}line+=item.str+(item.hasEOL?'\n':' ');lastY=y;}
   if(line)parts.push(line.trim());parts.push('');length=parts.join('\n').length;if(length>80000)break;
  }
  const text=parts.join('\n').slice(0,80000).trim();
  return {pages:pdf.numPages,text,status:!text?'no_text':pdf.numPages>30||length>80000?'partial':'extracted'};
 }catch(e){if(e.status)throw e;throw Object.assign(Error('Não foi possível ler este PDF. Confira se está íntegro e sem senha.'),{status:400});}
 finally{if(pdf)await pdf.loadingTask.destroy();}
}
// Conservative suggestions only. The user must confirm material, dates, destination and budget.
export function importSuggestions(text,state){
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),items=[];
 const value=labels=>{const line=lines.find(l=>labels.some(label=>normalizeText(l).startsWith(label+':')));return line?.slice(line.indexOf(':')+1).trim()||'';};
 const decimal=s=>Number(s.includes(',')?s.replaceAll('.','').replace(',','.'):s);
 for(const line of lines){
  // Explicit table-like lines: description ; quantity ; unit [; unit price].
  const match=line.match(/^(.{2,200}?)\s*[;|]\s*(\d+(?:[.,]\d+)?)\s*[;|]\s*([\p{L}³²0-9/]{1,15})(?:\s*[;|]\s*(?:R\$\s*)?([\d.,]+))?\s*$/u);
  if(!match)continue;const [,name,quantity,unit,price]=match;const qty=decimal(quantity);if(!Number.isFinite(qty)||qty<=0||qty>1e9)continue;
  const material=state.catalog.find(m=>normalizeText(m.name)===normalizeText(name)&&normalizeText(m.unit)===normalizeText(unit));
  items.push({kind:'material',material:material?.id||'',name,unit,qty,price:price?decimal(price):null,neededDate:'',location:'',service:''});if(items.length===100)break;
 }
 return {purpose:value(['finalidade','solicitacao'])||'Solicitação a partir do documento',supplier:value(['fornecedor','razao social']),payment:value(['pagamento','condicoes de pagamento']),scope:value(['escopo']),items};
}
