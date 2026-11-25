const $=s=>document.querySelector(s);
const DAYS=['الأحد','الاتنين','التلات','الأربع','الخميس','الجمعة','السبت'];
const ORDER=[6,0,1,2,3,4,5];
const fmt=n=>Math.round(n).toLocaleString('ar-EG')+' ج';
const ar=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return{ok:r.ok,j:await r.json().catch(()=>({}))}}
let plans=[],classes=[],day=null,bookId=null;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
const watch=()=>document.querySelectorAll('.rv:not(.in)').forEach(e=>io.observe(e));
function tm(t){const[h,m]=t.split(':').map(Number);return ar(((h+11)%12)+1)+':'+ar(String(m).padStart(2,'0'))+(h<12?' ص':' م')}
async function init(){
  plans=await fetch('/api/plans').then(r=>r.json());
  $('#plans-l').innerHTML=plans.map(p=>`<div class="plan rv ${p.hot?'hot':''}">${p.hot?'<span class="tag">الأكتر طلب</span>':''}<h3>${esc(p.name)}</h3><div class="pr">${fmt(p.price).replace(' ج','')} <small>جنيه</small></div><ul>${p.perks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><button class="btn ${p.hot?'':'ghost'}" onclick="openJoin(${p.id})">اشترك</button></div>`).join('');
  $('#jpl').innerHTML=plans.map(p=>`<option value="${p.id}">${esc(p.name)} - ${fmt(p.price)}</option>`).join('');
  $('#js').value=new Date().toISOString().slice(0,10);
  await loadClasses();watch();
}
async function loadClasses(){
  classes=await fetch('/api/classes').then(r=>r.json());
  const have=ORDER.filter(d=>classes.some(c=>c.weekday===d));
  if(day===null||!have.includes(day))day=have[0];
  $('#days').innerHTML=have.map(d=>`<button class="${d===day?'on':''}" data-d="${d}">${DAYS[d]}</button>`).join('');
  renderClasses();
}
function renderClasses(){
  const list=classes.filter(c=>c.weekday===day);
  $('#sched').innerHTML=list.map(c=>{const pct=Math.round(c.booked/c.capacity*100);
    return `<div class="cls ${c.left<=0?'full':''}"><div class="im"><img src="img/${esc(c.img)}.jpg" alt="" loading="lazy"></div><div class="bd"><h3>${esc(c.name)}<span>${tm(c.time)}</span></h3><p>${esc(c.trainer)} · ${ar(c.minutes)} دقيقة</p><div class="bar"><i data-w="${pct}"></i></div><div class="meta"><span>${c.left<=0?'كاملة العدد':'فاضل '+ar(c.left)+' أماكن'}</span><span>${ar(c.booked)}/${ar(c.capacity)}</span></div><button class="btn" ${c.left<=0?'disabled':''} onclick="openBook(${c.id})">${c.left<=0?'كاملة':'احجز'}</button></div></div>`}).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll('.bar i').forEach(i=>i.style.width=i.dataset.w+'%')));
}
$('#days').onclick=e=>{const d=e.target.dataset.d;if(d===undefined)return;day=Number(d);document.querySelectorAll('#days button').forEach(b=>b.classList.toggle('on',b.dataset.d===d));renderClasses()};
function closeM(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('show'))}
function openJoin(id){$('#jpl').value=id;$('#jf'+'')&&0;$('#mjf').style.display='block';$('#jres').innerHTML='';$('#jm').textContent='';$('#mj').classList.add('show')}
function openBook(id){bookId=id;const c=classes.find(x=>x.id===id);$('#mbt').textContent='حجز '+c.name+' - '+DAYS[c.weekday]+' '+tm(c.time);$('#bm').textContent='';$('#bm').className='msg';$('#mbf').style.display='block';$('#bc').value=localStorage.getItem('gm-code')||'';$('#mb').classList.add('show')}
$('#jgo').onclick=async()=>{
  const r=await post('/api/join',{name:$('#jn').value,phone:$('#jp').value,plan_id:$('#jpl').value,starts:$('#js').value});
  if(!r.ok){$('#jm').className='msg err';$('#jm').textContent=r.j.error;return}
  localStorage.setItem('gm-code',r.j.code);$('#mjf').style.display='none';$('#mjt').textContent='اشتراكك اتسجل';
  $('#jres').innerHTML=`<div class="ticket"><span style="color:var(--mut)">كود العضوية، احتفظ بيه</span><b class="code">${r.j.code}</b>باقة ${esc(r.j.plan)} · ${fmt(r.j.price)}<br>من ${r.j.starts} لحد ${r.j.ends}</div><p style="color:var(--mut);font-size:14px;margin:0">الدفع في الجيم عند أول زيارة (تجريبي).</p>`;
};
$('#bgo').onclick=async()=>{
  const code=$('#bc').value.trim();const r=await post('/api/book',{code,class_id:bookId});
  if(!r.ok){$('#bm').className='msg err';$('#bm').textContent=r.j.error;return}
  localStorage.setItem('gm-code',code.toUpperCase());
  $('#mbt').textContent='تم الحجز';$('#mbf').style.display='none';
  $('#mbt').insertAdjacentHTML('afterend',`<div class="ticket" id="bt"><b class="code" style="font-size:22px">${esc(r.j.name)}</b>${r.j.date} · ${tm(r.j.time)}<br>${esc(r.j.trainer)}<br>فاضل ${ar(r.j.left)} أماكن</div>`);
  loadClasses();
};
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeM()}));
const _close=closeM;window.closeM=function(){_close();$('#bt')&&$('#bt').remove()};
async function look(code){
  const r=await fetch('/api/member/'+encodeURIComponent(code)).then(async x=>({ok:x.ok,j:await x.json()}));
  if(!r.ok){$('#lkm').className='msg err';$('#lkm').textContent=r.j.error;return}
  $('#lkm').textContent='';const m=r.j;
  $('#mview').innerHTML=`<h3>${esc(m.name)} <span class="pill ${m.active?'booked':'cancelled'}">${m.active?'سارية':'منتهية'}</span></h3><p style="margin:0 0 12px;color:var(--mut)">باقة ${esc(m.plan)} · لحد ${m.ends}</p>`+
   (m.bookings.length?`<div class="scroll"><table><thead><tr><th>الحصة</th><th>التاريخ</th><th></th></tr></thead><tbody>${m.bookings.map(b=>`<tr><td>${esc(b.name)}<br><small style="color:var(--mut)">${tm(b.time)}</small></td><td dir="ltr" style="text-align:right">${b.date}</td><td>${b.status==='booked'?`<button class="btn ghost" style="padding:2px 12px;font-size:14px" onclick="cancelB(${b.id},'${m.code}')">إلغاء</button>`:'<span class="pill cancelled">ملغي</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<p style="color:var(--mut);margin:0">مفيش حجوزات لسه.</p>');
}
async function cancelB(id,code){const r=await post('/api/cancel',{code,booking_id:id});toast(r.ok?'اتلغى الحجز':r.j.error);look(code);loadClasses()}
$('#lkgo').onclick=()=>look($('#lk').value.trim());
if(localStorage.getItem('gm-code'))$('#lk').value=localStorage.getItem('gm-code');
addEventListener('scroll',()=>{const y=scrollY;if(y<900)$('#hbg').style.transform=`translateY(${y*.25}px)`},{passive:true});
init();
