const $=s=>document.querySelector(s);
const DAYS=['الأحد','الاتنين','التلات','الأربع','الخميس','الجمعة','السبت'];
$('#nd').innerHTML=[6,0,1,2,3,4,5].map(d=>`<option value="${d}">${DAYS[d]}</option>`).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token=sessionStorage.getItem('gm-admin')||'';
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1600)}
async function api(p,o={}){const r=await fetch(p,{...o,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}});const j=await r.json().catch(()=>({}));if(r.status===401){token='';sessionStorage.removeItem('gm-admin');show();throw new Error('auth')}return{ok:r.ok,j}}
function show(){$('#login').style.display=token?'none':'block';$('#app').style.display=token?'block':'none';if(token)refresh()}
$('#go').onclick=async()=>{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#pw').value})});const j=await r.json();if(!r.ok){$('#lmsg').className='msg err';$('#lmsg').textContent=j.error;return}token=j.token;sessionStorage.setItem('gm-admin',token);show()};
async function refresh(){
  const [s,m,b,c,p]=await Promise.all([api('/api/admin/stats'),api('/api/admin/members'),api('/api/admin/bookings'),api('/api/admin/classes'),fetch('/api/plans').then(r=>r.json())]);
  $('#stM').textContent=s.j.members.toLocaleString('ar-EG');$('#stB').textContent=s.j.bookings.toLocaleString('ar-EG');$('#stR').textContent=s.j.revenue.toLocaleString('ar-EG')+' ج';
  $('#cl').innerHTML=c.j.map(x=>`<tr><td>${esc(x.name)}<br><small style="color:var(--mut)">${esc(x.trainer)} · ${x.time}</small></td><td>${DAYS[x.weekday]}</td><td>${x.booked}</td><td><input type="number" value="${x.capacity}" data-cap="${x.id}" style="width:80px;margin:0" dir="ltr"></td><td><button class="btn ghost" style="padding:2px 12px" data-del="${x.id}">حذف</button></td></tr>`).join('');
  $('#pl').innerHTML=p.map(x=>`<tr><td>${esc(x.name)}</td><td><input type="number" value="${x.price}" data-pr="${x.id}" style="width:110px;margin:0" dir="ltr"> ج</td></tr>`).join('');
  $('#mem').innerHTML=m.j.map(x=>`<tr><td dir="ltr" style="text-align:right">${x.code}</td><td>${esc(x.name)}<br><small dir="ltr" style="color:var(--mut)">${esc(x.phone)}</small></td><td>${esc(x.plan)}</td><td dir="ltr" style="text-align:right">${x.ends}</td></tr>`).join('')||'<tr><td colspan=4 style="color:var(--mut)">لسه مفيش أعضاء</td></tr>';
  $('#bk').innerHTML=b.j.map(x=>`<tr><td>${esc(x.member)}<br><small dir="ltr" style="color:var(--mut)">${x.code}</small></td><td>${esc(x.class)} ${x.time}</td><td dir="ltr" style="text-align:right">${x.date}</td><td><span class="pill ${x.status}">${x.status==='booked'?'محجوز':'ملغي'}</span></td></tr>`).join('')||'<tr><td colspan=4 style="color:var(--mut)">لسه مفيش حجوزات</td></tr>';
}
document.addEventListener('change',async e=>{const t=e.target;
 if(t.dataset.cap){const r=await api('/api/admin/classes/'+t.dataset.cap,{method:'PATCH',body:JSON.stringify({capacity:t.value})});toast(r.ok?'اتحدثت السعة':r.j.error);refresh()}
 if(t.dataset.pr){const r=await api('/api/admin/plans/'+t.dataset.pr,{method:'PATCH',body:JSON.stringify({price:t.value})});toast(r.ok?'اتحدث السعر':r.j.error)}});
document.addEventListener('click',async e=>{const d=e.target.dataset.del;if(d){await api('/api/admin/classes/'+d,{method:'DELETE'});toast('اتحذفت');refresh()}});
$('#add').onclick=async()=>{const r=await api('/api/admin/classes',{method:'POST',body:JSON.stringify({name:$('#nn').value,trainer:$('#nt').value,weekday:$('#nd').value,time:$('#ntm').value,capacity:$('#nc').value,img:$('#ni').value})});$('#amsg').className='msg '+(r.ok?'ok':'err');$('#amsg').textContent=r.ok?'اتضافت الحصة':r.j.error;if(r.ok){$('#nn').value='';refresh()}};
show();
