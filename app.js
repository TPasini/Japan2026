import { firebaseConfig } from './config.js';
import { SEED } from './seed.js';

const DOC_PATH = ['trips', 'giappone2627'];
const CITY={Tokyo:{c:'var(--tokyo)',jp:'東京'},Hakone:{c:'var(--hakone)',jp:'箱根'},Kyoto:{c:'var(--kyoto)',jp:'京都'},Nara:{c:'var(--nara)',jp:'奈良'},Osaka:{c:'var(--osaka)',jp:'大阪'},Roma:{c:'var(--roma)',jp:'ローマ'}};
const TIPS={
d23:["Controlla passaporto, adattatore (prese tipo A, 100 V) e app Suica/Pasmo nel Wallet prima di partire.","Fuso orario: il Giappone è 8 ore avanti rispetto all'Italia in inverno."],
d24:["Golden Gai: bar minuscoli, alcuni chiedono un coperto all'ingresso; guarda i cartelli fuori.","Omoide Yokocho è più bello la sera, tra fumo di yakitori e lanterne."],
d25:["Spedizione bagagli (takkyūbin): si fa dalla reception o in un konbini; di solito arriva il giorno dopo, ma sotto Natale/Capodanno verifica i tempi.","Shibuya Crossing: la vista migliore è dall'alto."],
d26:["L'Hakone Free Pass copre treni, funivia e battello del giro classico.","In inverno il Fuji si vede meglio al mattino presto.","Owakudani: prova le uova nere (kuro-tamago). La funivia può chiudere per i gas vulcanici, controlla il giorno stesso."],
d27:["Da Hakone: si scende a Odawara e si prende lo Shinkansen per Kyoto (le corse Hikari o Kodama fermano lì).","Il bosco di bambù di Arashiyama è molto meno affollato la mattina presto.","Kiyomizu-dera è bellissimo al tramonto."],
d28:["Fushimi Inari è aperto sempre: al tramonto o di sera c'è meno gente. Salire fino in cima richiede 2-3 ore.","A Sanjūsangen-dō non si possono fare foto all'interno."],
d29:["Nara: i biscotti per i cervi (shika senbei) si comprano nel parco. Se fai l'inchino, alcuni lo ricambiano.","Da Nara a Osaka Namba c'è il treno diretto Kintetsu.","Da Rikuro's la coda si muove in fretta; la cheesecake si mangia calda."],
d30:["A Natale e Capodanno USJ è molto affollato: l'Express Pass fa davvero la differenza.","Super Nintendo World può richiedere un orario d'ingresso se non è incluso nell'Express."],
d31:["Senso-ji a mezzanotte: hatsumōde, la prima visita dell'anno al tempio. Folla enorme, ma l'atmosfera è unica.","Wing Stay Asakusa è a distanza a piedi dal tempio: comodo per il rientro.","Controlla se quest'anno ci sono treni notturni straordinari per Capodanno."],
d01:["Il 1° gennaio molti negozi e ristoranti sono chiusi: meglio prenotare o avere un piano B (konbini!).","Ueno: il parco e il santuario Tōshō-gū si girano bene a piedi."],
d02:["Fukubukuro: le 'buste fortunate' dei saldi di inizio anno. Code già prima dell'apertura nei grandi magazzini.","Tokyo City View (Roppongi Hills): vista notturna fantastica."],
d03:["Nakano Broadway: molti negozi aprono verso mezzogiorno, meglio andarci dopo Ikebukuro."],
d04:["Akihabara: Radio Kaikan, i negozi retro-game e i gashapon. Molti grandi negozi sono tax-free col passaporto."],
d05:["Lascia un margine per il controllo bagagli e gli acquisti tax-free (da tenere sigillati)."]};
const MONTH=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const WD=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const NAMEKEY='jp2627-name',UIKEY='jp2627-ui',HINTKEY='jp2627-hint',LOCALKEY='jp2627-localdoc';

const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pd=s=>{const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayStr=()=>ymd(new Date());
const uid=()=>Math.random().toString(36).slice(2,9);
const maps=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const slug=s=>String(s).replace(/[^a-z0-9]/gi,'_');

// ---------- seed: array -> mappe (così ogni campo si modifica separatamente) ----------
function seedDoc(){
  const days={};SEED.days.forEach(d=>{const items={};d.items.forEach((it,i)=>items[it.id]={t:it.t,done:false,o:i});days[d.id]={date:d.date,city:d.city,from:d.from||'',to:d.to||'',title:d.title,stay:d.stay,notes:d.notes,items}});
  const todos={};SEED.todos.forEach((t,i)=>todos[t.id]={t:t.t,day:t.day,done:false,o:i});
  return {days,todos,notes:'',flights:SEED.flights,stayInfo:{},updatedBy:'',updatedAt:null};
}
function toView(doc){
  const days=Object.entries(doc.days||{}).map(([id,d])=>({id,...d,items:Object.entries(d.items||{}).map(([iid,it])=>({id:iid,...it})).sort((a,b)=>a.o-b.o)})).sort((a,b)=>a.date<b.date?-1:1);
  const todos=Object.entries(doc.todos||{}).map(([id,t])=>({id,...t})).sort((a,b)=>a.o-b.o);
  return {...doc,days,todos};
}

// ---------- backend ----------
let state=toView(seedDoc()),loaded=false,net={pending:false,cache:true};
let write; // write(path, value|DELETE)
const DELETE={__del:true};
const configured=firebaseConfig&&firebaseConfig.apiKey&&!/INSERISCI/.test(firebaseConfig.apiKey);

async function startFirebase(){
  const V='10.12.2';
  const {initializeApp}=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const F=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app=initializeApp(firebaseConfig);
  let db;
  try{db=F.initializeFirestore(app,{localCache:F.persistentLocalCache({tabManager:F.persistentMultipleTabManager()})})}
  catch(e){db=F.getFirestore(app)}
  const ref=F.doc(db,...DOC_PATH);
  write=(path,value)=>F.updateDoc(ref,{[path]:value===DELETE?F.deleteField():value,updatedBy:myName()||'qualcuno',updatedAt:F.serverTimestamp()}).catch(err=>{console.error(err);toast('Modifica non salvata: '+(err.code||'errore'))});
  let seeded=false;
  F.onSnapshot(ref,{includeMetadataChanges:true},snap=>{
    net={pending:snap.metadata.hasPendingWrites,cache:snap.metadata.fromCache};
    if(!snap.exists()){
      if(!snap.metadata.fromCache&&!seeded){seeded=true;F.setDoc(ref,seedDoc())}
      renderStatus();return;
    }
    const d=snap.data();
    state=toView({...d,updatedAt:d.updatedAt&&d.updatedAt.toDate?d.updatedAt.toDate():null});
    loaded=true;softRender();
  },err=>{console.error(err);toast('Errore di collegamento: '+(err.code||''))});
}
function startLocal(){
  let doc;try{doc=JSON.parse(ls(LOCALKEY)||'null')}catch(e){}
  doc=doc||seedDoc();
  const apply=(path,value)=>{const p=path.split('.');let o=doc;for(let i=0;i<p.length-1;i++){o=o[p[i]]=o[p[i]]||{}}if(value===DELETE)delete o[p.at(-1)];else o[p.at(-1)]=value};
  write=(path,value)=>{apply(path,value);doc.updatedBy=myName();doc.updatedAt=Date.now();ls(LOCALKEY,JSON.stringify(doc));state=toView({...doc,updatedAt:new Date(doc.updatedAt)});softRender()};
  state=toView({...doc,updatedAt:doc.updatedAt?new Date(doc.updatedAt):null});loaded=true;net={pending:false,cache:false};
}

// ---------- UI state ----------
let ui={tab:'days',open:{},edit:null,flt:'all'};
try{Object.assign(ui,JSON.parse(sessionStorage.getItem(UIKEY)||'{}'))}catch(e){}
const saveUI=()=>{try{sessionStorage.setItem(UIKEY,JSON.stringify({tab:ui.tab,open:ui.open,flt:ui.flt}))}catch(e){}};
const myName=()=>ls(NAMEKEY)||'';
const theme=()=>ls('jp2627-theme')||'auto';
const isEditing=()=>{const a=document.activeElement;return a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT')&&document.getElementById('app').contains(a)};
let pendingRender=false;
function softRender(){if(isEditing()){pendingRender=true;renderStatus()}else render()}
document.addEventListener('focusout',()=>setTimeout(()=>{if(pendingRender&&!isEditing()){pendingRender=false;render()}},120));
let toastT;
function toast(t){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el)}el.textContent=t;el.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>el.style.display='none',3500)}

function renderStatus(){
  const el=document.getElementById('status');if(!el)return;
  let c,t;
  if(!configured){c='loc';t='Prova (solo su questo telefono)'}
  else if(!navigator.onLine){c='busy';t='Offline · salvo sul telefono'}
  else if(net.pending){c='busy';t='Invio modifiche…'}
  else if(!loaded){c='';t='Caricamento…'}
  else{c='ok';t='Sincronizzato'}
  el.innerHTML='<span class="dot '+c+'"></span>'+t;
}
addEventListener('online',renderStatus);addEventListener('offline',renderStatus);

// ---------- views ----------
const day=id=>state.days.find(d=>d.id===id);
const tag=c=>{const x=CITY[c]||{c:'#888',jp:''};return '<span class="tag" style="background:'+x.c+'">'+h(c)+' <span class="jp">'+x.jp+'</span></span>'};
function countdown(){
  const t=pd(todayStr()),s=pd('2026-12-23'),e=pd('2027-01-06'),ms=864e5;
  if(t<s){const n=Math.round((s-t)/ms);return 'Mancano <b>'+n+'</b> '+(n===1?'giorno':'giorni')+' alla partenza'}
  if(t<=e)return 'Giorno <b>'+(Math.round((t-s)/ms)+1)+'</b> di 15 · buon viaggio!';
  return 'Viaggio concluso · おつかれさま';
}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let installEvt=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(ui.tab==='days')render()});
function installHint(){
  if(standalone()||ls(HINTKEY))return '';
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
  const how=ios?'Tocca il tasto <b>Condividi</b> (il quadrato con la freccia in su) e poi <b>“Aggiungi alla schermata Home”</b>.':(installEvt?'Tocca il pulsante qui sotto.':'Apri il menu <b>⋮</b> del browser e scegli <b>“Aggiungi a schermata Home”</b> o <b>“Installa app”</b>.');
  return '<div class="card pad hint"><b>📲 Mettila sul telefono come un\'app</b><div style="font-size:14.5px;margin-top:4px">'+how+'</div><div class="row" style="margin-top:10px;gap:8px">'+(installEvt?'<button class="btn pri" data-act="install">Installa</button>':'')+'<button class="btn sm" data-act="hideHint">Ho capito</button></div></div>';
}
function hero(){
  const r=['Tokyo','Hakone','Kyoto','Nara','Osaka','Tokyo'];
  return '<header class="hero wrap"><div class="sun"></div><h1><small>日本 · CAPODANNO 26/27</small>Giappone</h1><div class="count">'+countdown()+'</div><div class="dates">23 dicembre 2026 → 6 gennaio 2027</div><div class="route">'+r.map((c,i)=>(i?'<i>→</i>':'')+'<span class="c" style="background:'+CITY[c].c+'">'+c+'</span>').join('')+'</div></header>';
}
function dayCard(d){
  const dt=pd(d.date),isT=d.date===todayStr(),op=!!ui.open[d.id],ed=ui.edit===d.id;
  const done=d.items.filter(i=>i.done).length;
  const sum=d.items.map(i=>i.t).slice(0,3).join(' · ')+(d.items.length>3?' …':'');
  let s='<div class="card day'+(op?' open':'')+(isT?' today':'')+'" id="card-'+d.id+'" style="--cc:'+(CITY[d.city]||{c:'#888'}).c+'"><button class="day-h" data-act="toggle" data-id="'+d.id+'"><div class="date"><div class="m">'+MONTH[dt.getMonth()]+'</div><div class="n">'+dt.getDate()+'</div><div class="w">'+WD[dt.getDay()]+'</div></div><div class="day-b"><div>'+(d.from?'<span class="via">'+h(d.from)+' → </span>':'')+tag(d.city)+(d.to?'<span class="via"> → '+h(d.to)+'</span>':'')+(isT?'<span class="today-lbl">OGGI</span>':'')+'</div><div class="sum"><span class="ttl">'+h(d.title)+'</span>'+(d.items.length?'<div class="sub">'+h(sum)+'</div><div class="bar"><i><b style="width:'+Math.round(100*done/d.items.length)+'%"></b></i>'+done+'/'+d.items.length+'</div>':'')+'</div></div><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>';
  if(!op)return s+'</div>';
  s+='<div class="day-d">';
  if(ed){
    s+='<div class="lbl">Titolo</div><input type="text" data-f="title" data-id="'+d.id+'" value="'+h(d.title)+'"><div class="lbl">Cosa fare</div><ul class="items">'+d.items.map(i=>'<li><input type="text" data-f="item" data-id="'+d.id+'" data-i="'+i.id+'" value="'+h(i.t)+'"><button class="x" data-act="delItem" data-id="'+d.id+'" data-i="'+i.id+'" aria-label="Elimina">×</button></li>').join('')+'</ul><div class="row" style="margin-top:8px"><input type="text" id="new-'+d.id+'" placeholder="Aggiungi una tappa…"><button class="btn" data-act="addItem" data-id="'+d.id+'">Aggiungi</button></div><div class="lbl">Alloggio</div><input type="text" data-f="stay" data-id="'+d.id+'" value="'+h(d.stay)+'"><div class="row" style="margin-top:12px"><button class="btn pri" data-act="editOff">Fatto</button></div>';
  }else{
    s+='<div class="lbl">Cosa fare</div>'+(d.items.length?'<ul class="items">'+d.items.map(i=>'<li class="'+(i.done?'done':'')+'"><button class="chk'+(i.done?' on':'')+'" data-act="tick" data-id="'+d.id+'" data-i="'+i.id+'" aria-label="Fatto">'+(i.done?'✓':'')+'</button><span class="it-t">'+h(i.t)+'</span>'+(/^(Treno|Volo|Shinkansen|Ryokan|Vista)/.test(i.t)?'':'<a class="pin" href="'+maps(i.t.replace(/\(.*?\)/g,'')+' '+(/Nara/.test(i.t)?'Nara':d.city))+'" target="_blank" rel="noopener">Mappa</a>')+'</li>').join('')+'</ul>':'<div class="empty">Niente in programma.</div>');
    if(d.stay)s+='<div class="lbl">Si dorme</div><div class="stay"><span style="font-size:20px">🛏</span><div style="flex:1">'+h(d.stay)+'</div>'+(d.stay!=='In volo'?'<a class="pin" href="'+maps(d.stay+' '+d.city)+'" target="_blank" rel="noopener">Mappa</a>':'')+'</div>';
    const tp=TIPS[d.id]||[];if(tp.length)s+='<div class="lbl">Consigli</div><ul class="tips">'+tp.map(t=>'<li>'+h(t)+'</li>').join('')+'</ul>';
    const td=state.todos.filter(t=>t.day===d.id);
    if(td.length)s+='<div class="lbl">Da prenotare / decidere</div>'+td.map(t=>'<div class="row" style="padding:4px 0"><button class="chk'+(t.done?' on':'')+'" data-act="todo" data-t="'+t.id+'">'+(t.done?'✓':'')+'</button><span style="font-size:14.5px'+(t.done?';text-decoration:line-through;color:var(--soft)':'')+'">'+h(t.t)+'</span></div>').join('');
    s+='<div class="lbl">Note del giorno</div><textarea data-f="notes" data-id="'+d.id+'" placeholder="Scrivi qui orari, idee, ristoranti…">'+h(d.notes)+'</textarea><div class="row" style="margin-top:10px"><button class="btn" data-act="editOn" data-id="'+d.id+'">✎ Modifica programma</button></div>';
  }
  return s+'</div></div>';
}
const viewDays=()=>'<div class="wrap">'+installHint()+'<h2 class="sec">Il viaggio<span>旅程</span></h2>'+state.days.map(dayCard).join('')+'</div>';
function viewTodos(){
  const list=state.todos.filter(t=>ui.flt==='all'||(ui.flt==='open'?!t.done:t.done)),open=state.todos.filter(t=>!t.done).length;
  return '<div class="wrap"><h2 class="sec">Da fare<span>予約</span></h2><div class="meta" style="margin:-4px 0 10px">'+open+' cose ancora aperte</div><div class="flt">'+[['all','Tutte'],['open','Da fare'],['done','Fatte']].map(([v,l])=>'<button class="btn sm'+(ui.flt===v?' on':'')+'" data-act="flt" data-v="'+v+'">'+l+'</button>').join('')+'</div><div class="card">'+(list.length?list.map(t=>{const d=t.day&&day(t.day),dt=d&&pd(d.date);return '<div class="todo"><button class="chk'+(t.done?' on':'')+'" data-act="todo" data-t="'+t.id+'">'+(t.done?'✓':'')+'</button><div style="flex:1"><div style="'+(t.done?'text-decoration:line-through;color:var(--soft)':'')+'">'+h(t.t)+'</div>'+(d?'<div class="d">'+dt.getDate()+' '+MONTH[dt.getMonth()]+' · '+h(d.city)+'</div>':'')+'</div><button class="x" data-act="delTodo" data-t="'+t.id+'" aria-label="Elimina">×</button></div>'}).join(''):'<div class="pad empty">Niente qui.</div>')+'</div><div class="row"><input type="text" id="newTodo" placeholder="Nuova cosa da fare…"><button class="btn pri" data-act="addTodo">+</button></div></div>';
}
function stays(){
  const out=[];state.days.forEach(d=>{if(!d.stay||d.stay==='In volo')return;const l=out.at(-1),prev=pd(d.date);prev.setDate(prev.getDate()-1);if(l&&l.name===d.stay&&l.last===ymd(prev)){l.n++;l.last=d.date}else out.push({name:d.stay,city:d.city,first:d.date,last:d.date,n:1})});return out;
}
const fmt=(s,plus)=>{const d=pd(s);if(plus)d.setDate(d.getDate()+1);return d.getDate()+' '+MONTH[d.getMonth()]};
const viewStays=()=>'<div class="wrap"><h2 class="sec">Alloggi<span>宿泊</span></h2>'+stays().map(s=>'<div class="card pad"><div class="row" style="justify-content:space-between">'+tag(s.city)+'<span class="meta" style="margin:0">'+s.n+(s.n===1?' notte':' notti')+'</span></div><div class="stay-name">'+h(s.name)+'</div><div class="meta" style="margin:0 0 10px">Check-in '+fmt(s.first)+' · Check-out '+fmt(s.last,true)+'</div><textarea data-f="stayInfo" data-k="'+slug(s.name)+'" placeholder="Indirizzo, codice di prenotazione, orari di check-in…" style="min-height:64px">'+h((state.stayInfo||{})[slug(s.name)])+'</textarea><div class="row" style="margin-top:8px"><a class="pin" href="'+maps(s.name+' '+s.city)+'" target="_blank" rel="noopener">Apri in Mappe</a></div></div>').join('')+'</div>';
function viewInfo(){
  const f=state.flights||{};
  const ph=[['Grazie','ありがとう','arigatō'],['Mi scusi / Permesso','すみません','sumimasen'],['Quanto costa?','いくらですか','ikura desu ka'],['Il conto, per favore','お会計お願いします','okaikei onegaishimasu'],["Dov'è…?",'…はどこですか','… wa doko desu ka'],['Buon anno!','あけましておめでとう','akemashite omedetō'],['Delizioso','おいしい','oishii']];
  const facts=["Fuso orario: +8 ore rispetto all'Italia.",'Prese tipo A, 100 V: serve un adattatore.','Suica/Pasmo nel Wallet del telefono: treni, metro, konbini e distributori.',"Porta sempre un po' di contanti: alcuni locali piccoli e templi accettano solo quelli.",'Tax-free: nei negozi aderenti, mostrando il passaporto.','Niente mance: possono creare imbarazzo.',"Dal 29/12 al 3/1 è periodo di festa: alcuni negozi, musei e ristoranti chiudono o cambiano orari.",'In metro e sui treni si parla a bassa voce e non si telefona.'];
  return '<div class="wrap"><h2 class="sec">Info utili<span>情報</span></h2><div class="card pad"><div class="lbl" style="margin-top:0">Volo di andata</div><textarea data-f="flight" data-k="andata" style="min-height:56px">'+h(f.andata)+'</textarea><div class="lbl">Volo di ritorno</div><textarea data-f="flight" data-k="ritorno" style="min-height:56px">'+h(f.ritorno)+'</textarea></div><div class="card pad"><div class="lbl" style="margin-top:0">Emergenze</div><div class="kv"><b>110</b><span>Polizia</span><b>119</b><span>Ambulanza e vigili del fuoco</span></div></div><div class="card pad"><div class="lbl" style="margin-top:0">Da sapere</div><ul class="tips">'+facts.map(t=>'<li>'+h(t)+'</li>').join('')+'</ul></div><div class="card pad"><div class="lbl" style="margin-top:0">Frasi utili</div><div class="phr">'+ph.map(p=>'<div><b>'+h(p[0])+'</b><div class="meta" style="margin:0">'+h(p[2])+'</div></div><div class="jp">'+p[1]+'</div>').join('')+'</div></div></div>';
}
function viewNotes(){
  const u=state.updatedAt;
  return '<div class="wrap"><h2 class="sec">Note di gruppo<span>メモ</span></h2><div class="card pad"><textarea data-f="gnotes" style="min-height:220px" placeholder="Idee, ristoranti, cose da comprare, conti…">'+h(state.notes)+'</textarea>'+(u?'<div class="meta">Ultima modifica: '+u.toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(state.updatedBy?' · '+h(state.updatedBy):'')+'</div>':'')+'</div><div class="card pad"><div class="lbl" style="margin-top:0">Il tuo nome</div><div class="meta" style="margin:-2px 0 8px">Così gli altri vedono chi ha fatto l\'ultima modifica.</div><input type="text" id="myname" value="'+h(myName())+'" placeholder="Il tuo nome"></div><div class="card pad"><div class="lbl" style="margin-top:0">Aspetto</div><div class="seg">'+[['auto','Automatico'],['light','Chiaro'],['dark','Scuro']].map(([v,l])=>'<button class="btn sm'+(theme()===v?' on':'')+'" data-act="theme" data-v="'+v+'">'+l+'</button>').join('')+'</div></div><div class="meta" style="text-align:center;margin:18px 0">Le modifiche arrivano a tutti in automatico. Senza internet puoi continuare a scrivere: le modifiche vengono inviate appena torna la connessione.</div></div>';
}
function nameDialog(){
  if(myName())return '';
  return '<div class="ovl"><div class="dlg"><div style="font-family:var(--serif);font-size:24px;font-weight:700">ようこそ!</div><div style="margin:6px 0 14px;color:var(--soft)">Benvenuto nella guida del viaggio. Come ti chiami?</div><input type="text" id="firstname" placeholder="Il tuo nome" autocomplete="given-name"><button class="btn pri" style="width:100%;margin-top:12px;padding:12px" data-act="setName">Inizia</button></div></div>';
}
function render(){
  const tabs=[['days','旅','Viaggio'],['todos','予','Da fare'],['stays','宿','Alloggi'],['info','知','Info'],['notes','記','Note']];
  const v={days:viewDays,todos:viewTodos,stays:viewStays,info:viewInfo,notes:viewNotes}[ui.tab]();
  const y=scrollY;
  document.getElementById('app').innerHTML='<div id="status" class="status"></div>'+(ui.tab==='days'?hero():'')+v+'<nav class="tabs">'+tabs.map(t=>'<button data-act="tab" data-v="'+t[0]+'" class="'+(ui.tab===t[0]?'on':'')+'"><span class="ic">'+t[1]+'</span>'+t[2]+'</button>').join('')+'</nav>'+nameDialog();
  scrollTo(0,y);renderStatus();
}

// ---------- interazioni ----------
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=b.dataset.id,d=id&&day(id);
  if(a==='tab'){ui.tab=b.dataset.v;ui.edit=null;saveUI();render();scrollTo(0,0);return}
  if(a==='toggle'){ui.open[id]=!ui.open[id];if(!ui.open[id]&&ui.edit===id)ui.edit=null;saveUI();render();return}
  if(a==='tick'){const it=d.items.find(i=>i.id===b.dataset.i);write(`days.${id}.items.${it.id}.done`,!it.done);return}
  if(a==='todo'){const t=state.todos.find(x=>x.id===b.dataset.t);write(`todos.${t.id}.done`,!t.done);return}
  if(a==='delTodo'){if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Elimina?';b.style.fontSize='13px';return}write(`todos.${b.dataset.t}`,DELETE);return}
  if(a==='addTodo'){const inp=document.getElementById('newTodo'),v=inp.value.trim();if(!v)return;inp.value='';inp.blur();write(`todos.${uid()}`,{t:v,day:'',done:false,o:Date.now()});return}
  if(a==='flt'){ui.flt=b.dataset.v;saveUI();render();return}
  if(a==='editOn'){ui.edit=id;render();return}
  if(a==='editOff'){ui.edit=null;render();return}
  if(a==='delItem'){write(`days.${id}.items.${b.dataset.i}`,DELETE);return}
  if(a==='addItem'){const ni=document.getElementById('new-'+id),v=ni.value.trim();if(!v)return;ni.value='';ni.blur();write(`days.${id}.items.${uid()}`,{t:v,done:false,o:Date.now()});return}
  if(a==='theme'){ls('jp2627-theme',b.dataset.v);document.documentElement.dataset.theme=b.dataset.v;render();return}
  if(a==='hideHint'){ls(HINTKEY,'1');render();return}
  if(a==='install'&&installEvt){installEvt.prompt();installEvt.userChoice.finally(()=>{installEvt=null;render()});return}
  if(a==='setName'){const v=document.getElementById('firstname').value.trim();if(!v)return;ls(NAMEKEY,v);render();return}
});
const timers={};
function fieldWrite(el){
  const f=el.dataset.f,id=el.dataset.id,v=el.value;
  const path={notes:`days.${id}.notes`,title:`days.${id}.title`,stay:`days.${id}.stay`,item:`days.${id}.items.${el.dataset.i}.t`,gnotes:'notes',stayInfo:`stayInfo.${el.dataset.k}`,flight:`flights.${el.dataset.k}`}[f];
  if(path)write(path,v);
}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.f)return;const k=el.dataset.f+(el.dataset.id||'')+(el.dataset.i||'')+(el.dataset.k||'');clearTimeout(timers[k]);timers[k]=setTimeout(()=>fieldWrite(el),900)});
document.addEventListener('change',e=>{const el=e.target;if(el.id==='myname'){ls(NAMEKEY,el.value.trim());toast('Nome salvato.');return}if(!el.dataset||!el.dataset.f)return;const k=el.dataset.f+(el.dataset.id||'')+(el.dataset.i||'')+(el.dataset.k||'');clearTimeout(timers[k]);fieldWrite(el)});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key==='Enter'&&t.id&&(t.id==='newTodo'||t.id==='firstname'||t.id.startsWith('new-'))){e.preventDefault();t.parentNode.querySelector('button')?.click()}});

// ---------- avvio ----------
const td=todayStr(),todayDay=state.days.find(d=>d.date===td);
if(todayDay&&!sessionStorage.getItem('jp2627-auto')){ui.open[todayDay.id]=true;try{sessionStorage.setItem('jp2627-auto','1')}catch(e){}}
if(configured){render();startFirebase().catch(err=>{console.error(err);toast('Impossibile collegarsi: controlla la connessione.')})}
else{startLocal();render()}
if(todayDay&&ui.tab==='days')setTimeout(()=>document.querySelector('.today')?.scrollIntoView({block:'start',behavior:'smooth'}),300);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
