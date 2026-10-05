import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export async function reportPDF(report){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 pdf.setTitle('Fasolo e Simon · '+report.title);pdf.setAuthor(report.generatedBy);pdf.setCreationDate(new Date(report.generatedAt));
 const clean=value=>Array.from(String(value??'')).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');
 const wrap=(text,width,size=9)=>String(text).split('\n').flatMap(line=>{
  const result=[];let current='';for(const char of clean(line)){if(font.widthOfTextAtSize(current+char,size)>width&&current){result.push(current);current='';}current+=char;}result.push(current);return result;
 });
 const width=842,height=595,margin=34,gap=10,column=(width-margin*2)/report.headers.length;let page,y;
 const draw=(text,x,top,size=9,strong=false)=>page.drawText(clean(text),{x,y:top,size,font:strong?bold:font,color:rgb(.19,.27,.3)});
 function nextPage(){page=pdf.addPage([width,height]);y=height-36;draw('FASOLO & SIMON',margin,y,16,true);y-=23;for(const line of wrap(report.title+' · '+report.work.name,width-margin*2,12)){draw(line,margin,y,12,true);y-=15;}y-=5;for(const line of wrap('Emitido por '+report.generatedBy+' em '+report.generatedAt,width-margin*2,8)){draw(line,margin,y,8);y-=11;}for(const line of wrap(report.period+' | '+(report.filters.from||'início')+' a '+(report.filters.to||'atual')+' | Busca: '+(report.filters.query||'todas'),width-margin*2,8)){draw(line,margin,y,8);y-=11;}y-=15;const titles=report.headers.map(h=>wrap(h,column-gap,8));titles.forEach((lines,i)=>lines.forEach((line,n)=>draw(line,margin+i*column,y-n*11,8,true)));y-=Math.max(...titles.map(t=>t.length))*11+3;page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:1,color:rgb(.52,.46,.3)});y-=14;}
 nextPage();
 for(const row of report.rows){const cells=row.map(c=>wrap(c,column-gap));const max=Math.max(...cells.map(c=>c.length));let offset=0;
  while(offset<max){if(y<65)nextPage();const take=Math.min(max-offset,Math.floor((y-50)/12));for(let line=0;line<take;line++){cells.forEach((c,i)=>{if(c[offset+line])draw(c[offset+line],margin+i*column,y-line*12);});}y-=take*12+9;offset+=take;if(offset<max)nextPage();}
 }
 if(!report.rows.length){draw('Nenhum registro corresponde aos filtros.',margin,y);y-=20;}
 for(const line of wrap(report.note,width-margin*2,8)){if(y<60)nextPage();draw(line,margin,y,8);y-=12;}
 const pages=pdf.getPages();pages.forEach((p,n)=>p.drawText(`${n+1}/${pages.length} · ${report.rows.length} linhas`,{x:margin,y:22,size:8,font}));
 return pdf.save();
}
