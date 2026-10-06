// Shared payroll calculations: keep consistent with the HR deductions page.
const vals=value=>Object.values(value||{}).filter(Boolean);
const keyDate=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function nextDate(value){const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+1);return keyDate(d);}
export function monthDate(value,offset=1,day=Number(value.slice(8))){const [y,m]=value.split('-').map(Number),d=new Date(y,m-1+offset,1,12);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return keyDate(d);}
export function resolvePayrollPeriod(config={},today){let start=config.startDate||'',end=config.endDate||'';if(!start||!end)return{start,end,active:false};if(end<today&&!config.fixed)return{start:nextDate(end),end:'',active:false};if(config.fixed){const endDay=config.endDay||Number(end.slice(8));while(end<today){start=nextDate(end);end=monthDate(end,1,endDay);}}return{start,end,endDay:config.endDay||Number(end.slice(8)),active:Boolean(start&&end&&end>=start)};}
export function payrollWindows(period){return[{start:period.start,end:period.end,tone:'red'},{start:nextDate(period.end),end:monthDate(period.end,1,period.endDay),tone:'amber'}];}
const minutes=value=>String(value||'00:00').split(':').map(Number).reduce((h,m)=>h*60+m);
const shiftEnd=(date,assignment)=>{let stamp=Date.parse(`${date}T${assignment.to}:00+03:00`);if(minutes(assignment.to)<=minutes(assignment.from))stamp+=86400000;return stamp;};
function penaltyType(reason=''){const branch=reason.match(/في فرع (.+?)(?: بتاريخ|$)/)?.[1];if(reason.includes('بصمة دخول'))return`بصمة حضور مفقودة${branch?' من فرع '+branch:''}`;if(reason.includes('بصمة خروج'))return`بصمة انصراف مفقودة${branch?' من فرع '+branch:''}`;return reason||'خصم بصمة';}
export function buildPayrollLedger(source,employees,now=Date.now()){
 const records=[],known=new Map(employees.map(e=>[e.id,e]));
 for(const [date,schedule] of Object.entries(source.schedules||{})){
  const assignments=vals(schedule.assignments).filter(a=>a.employeeId&&a.from&&a.to).sort((a,b)=>a.from.localeCompare(b.from));
  for(const employeeId of new Set(assignments.map(a=>a.employeeId))){
   const shifts=assignments.filter(a=>a.employeeId===employeeId),events=vals(source.attendance?.[date]?.[employeeId]).slice();
   for(const p of vals(source.legacy)){if(p.date?.slice(0,10)!==date)continue;const employee=known.get(String(p.empId))||employees.find(e=>e.fullName===p.empName);if(employee?.id!==employeeId)continue;const stamp=Date.parse(p.iso||`${date}T${p.timeExact||p.time||'00:00'}+03:00`);if(stamp)events.push({timestamp:stamp,type:p.type==='out'?'checkOut':'checkIn'});}
   // Match each event to its scheduled time window, retaining orphan checkout punches.
   const buckets=shifts.map(()=>[]);for(const event of events.sort((a,b)=>Number(a.timestamp)-Number(b.timestamp))){const stamp=Number(event.timestamp);const candidates=shifts.map((a,index)=>{const start=Date.parse(`${date}T${a.from}:00+03:00`),end=shiftEnd(date,a),target=event.type==='checkOut'?end:start;return{index,distance:Math.abs(stamp-target),branch:a.branchId};}).filter(c=>!event.branchId||event.branchId===c.branch);const selected=candidates.sort((a,b)=>a.distance-b.distance)[0];if(selected)buckets[selected.index].push(event);}
   shifts.forEach((a,index)=>{const events=buckets[index],checkIn=events.find(e=>e.type==='checkIn'),checkOut=events.filter(e=>e.type==='checkOut').at(-1),branch=({hawalli:'حولي',abu_al_hasaniya:'أبو الحصانية',yarmouk:'اليرموك'})[a.branchId]||a.branchName||a.branchId||'غير محدد',start=Date.parse(`${date}T${a.from}:00+03:00`),end=shiftEnd(date,a),duration=Math.max(0,Math.round((end-start)/60000)-Number(a.breakMinutes||0));let type='',deducted=0;
    if(!checkIn&&!checkOut&&now>=end){type=shifts.length>1?`غياب عن فترة دوام ${branch}`:'غياب';deducted=duration;}
    else if(checkIn){deducted=Math.max(0,Math.floor((Number(checkIn.timestamp)-start)/60000));if(deducted<=10)deducted=0;deducted=Math.min(deducted,duration);if(deducted)type=`تأخير بالحضور في فرع ${branch}`;}
    if(type&&deducted)records.push({id:`time-${date}-${employeeId}-${a.id||`${a.branchId}-${a.from}-${a.to}`}`,employeeId,date,type,minutes:deducted,category:'time',notes:'',from:a.from,to:a.to,branch});
   });
  }
 }
 for(const book of vals(source.books)){if(book.employeeId&&book.date)records.push({id:`book-${book.id}`,employeeId:book.employeeId,date:book.date,type:'كتاب خصم',bookId:book.id,bookNumber:book.bookNumber,amountFils:Math.round(Number(book.amount||0)*1000),category:'amount',sourceReason:book.reason||'',notes:''});}
 for(const [date,items] of Object.entries(source.penalties||{}))for(const [id,p] of Object.entries(items||{})){records.push({id:`penalty-${date}-${id}`,employeeId:p.employeeId,date:p.date||date,type:penaltyType(p.reason),amountFils:Number(p.amountFils??Math.round(Number(p.amount||0)*1000)),category:'amount',sourceReason:p.reason||'',notes:''});}
 return records.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
