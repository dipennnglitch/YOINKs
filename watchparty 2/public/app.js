const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const H={},cols=['#ffb547','#5be3d0','#ff7aa8','#9d8cff','#8be28b','#ff9a62'];
let sb,ch,cfg,users=[],over=null,open=false,player=null,last={p:false,t:0,at:0},mute=0,title='',chatLog=[],peers={},stream=null,
  inCall=false,curVideo=null,browseUrl='',roomCode='',polls={},reacts=[],prev=[];
const me={id:crypto.randomUUID(),name:'',joined:Date.now()};
me.color=cols[parseInt(me.id.slice(0,2),16)%6];
const ytReady=new Promise(r=>window.onYouTubeIframeAPIReady=r);
const hostId=()=>users.some(u=>u.id===over)?over:[...users].sort((a,b)=>a.joined-b.joined)[0]?.id;
const isHost=()=>hostId()===me.id,canCtl=()=>isHost()||open,allowed=f=>f===hostId()||open;
const nameOf=id=>(users.find(u=>u.id===id)||{}).name||'Guest';
const emit=(e,p={})=>ch.send({type:'broadcast',event:e,payload:{...p,from:me.id}});
const emitL=(e,p={})=>{emit(e,p);H[e]({...p,from:me.id})};
const on=(e,fn)=>{H[e]=fn;ch.on('broadcast',{event:e},({payload})=>fn(payload))};
const track=()=>ch.track({name:me.name,color:me.color,joined:me.joined,call:inCall});

/* lobby */
const qs=new URLSearchParams(location.search);$('#code').value=qs.get('room')||'';$('#name').value=localStorage.vrName||'';
async function enter(c){me.name=$('#name').value.trim()||'Guest';localStorage.vrName=me.name;roomCode=c.toUpperCase().replace(/[^A-Z0-9]/g,'');
  cfg=await(await fetch('/api/config')).json();
  if(!cfg.url)return alert('Setup missing: add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel (see README).');
  history.replaceState(0,'','?room='+roomCode);$('#lobby').hidden=true;$('#room').hidden=false;
  $('#copy').textContent='Room '+roomCode+' · copy invite';
  sb=supabase.createClient(cfg.url,cfg.key);ch=sb.channel('room:'+roomCode,{config:{presence:{key:me.id}}});bind();
  ch.subscribe(async s=>{if(s==='SUBSCRIBED'){await track();emit('hello')}})}
$('#create').onclick=()=>enter(Math.random().toString(36).slice(2,7));
$('#join').onclick=()=>$('#code').value.trim()?enter($('#code').value.trim()):$('#code').focus();
$('#copy').onclick=()=>{navigator.clipboard.writeText(location.href);$('#copy').textContent='Invite link copied'};
$$('.tabs').forEach(t=>t.onclick=e=>{const b=e.target.closest('button');if(!b)return;
  t.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  t.parentElement.querySelectorAll(':scope>.pane').forEach(p=>p.classList.toggle('on',p.id===b.dataset.t))});

/* players: play/pause/seek/playing/time/dur */
const parse=u=>{let m;
  if(m=u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/))return{type:'yt',src:m[1]};
  if(m=u.match(/vimeo\.com\/(?:video\/)?(\d+)/))return{type:'vm',src:m[1]};
  return{type:'file',src:u}};
async function load(v){curVideo=v;player=null;reacts=[];heat();const scr=$('#screen');scr.innerHTML='';title=v.title||v.src;
  if(v.type==='yt'){await ytReady;scr.innerHTML='<div id="ytp"></div>';
    const p=new YT.Player('ytp',{videoId:v.src,playerVars:{playsinline:1,rel:0},events:{onReady:()=>{title=p.getVideoData().title||title;heat()}}});
    player={play:()=>p.playVideo(),pause:()=>p.pauseVideo(),seek:t=>p.seekTo(t,true),dur:()=>p.getDuration?p.getDuration():0,
      playing:()=>p.getPlayerState&&p.getPlayerState()==1,time:()=>p.getCurrentTime?p.getCurrentTime():0}}
  else if(v.type==='vm'){scr.innerHTML=`<iframe src="https://player.vimeo.com/video/${v.src}" allow="autoplay;fullscreen"></iframe>`;
    const p=new Vimeo.Player(scr.firstChild),c={p:false,t:0,d:0};p.getDuration().then(d=>{c.d=d;heat()});
    p.on('play',()=>c.p=true);p.on('pause',()=>c.p=false);p.on('timeupdate',d=>c.t=d.seconds);
    player={play:()=>p.play(),pause:()=>p.pause(),seek:t=>p.setCurrentTime(t),dur:()=>c.d,playing:()=>c.p,time:()=>c.t}}
  else{scr.innerHTML=`<video controls playsinline src="${esc(v.src)}"></video>`;const e=scr.firstChild;e.onloadedmetadata=heat;
    player={play:()=>e.play().catch(()=>{}),pause:()=>e.pause(),seek:t=>e.currentTime=t,dur:()=>e.duration||0,playing:()=>!e.paused,time:()=>e.currentTime}}}
function apply(st){if(!player)return;mute=Date.now()+1200;
  if(Math.abs(player.time()-st.time)>1.2)player.seek(st.time);
  st.playing?player.play():player.pause();last={p:st.playing,t:st.time,at:Date.now()}}
setInterval(()=>{if(!player||!ch)return;const p=!!player.playing(),t=player.time()||0,now=Date.now();
  const exp=last.t+(last.p?(now-last.at)/1000:0);
  if((p!==last.p||Math.abs(t-exp)>1.5)&&now>mute&&canCtl())emit('state',{playing:p,time:t});
  last={p,t,at:now}},400);
setInterval(()=>{if(player&&isHost()&&player.playing())emit('state',{playing:true,time:player.time()})},4000);
$('#load').onclick=()=>{const u=$('#url').value.trim();if(!u)return;
  if(!canCtl())return sys('Only the host can change the video.');
  if(/^https?:\/\//i.test(u)&&!/youtu|vimeo|\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(u)){emitL('browse',{u});return sys('Shared as a browse page. Open the Browse tab.')}
  emitL('video',parse(u))};
$('#url').onkeydown=e=>e.key==='Enter'&&$('#load').click();
$('#file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  if(!canCtl())return sys('Only the host can change the video.');sys('Uploading '+f.name+'…');
  const path=`${roomCode}/${Date.now()}-${f.name.replace(/[^\w.-]/g,'_')}`;
  const{error}=await sb.storage.from('videos').upload(path,f,{contentType:f.type});
  if(error)return sys('Upload failed: '+error.message+' (free plan limit is 50 MB)');
  emitL('video',{type:'file',src:sb.storage.from('videos').getPublicUrl(path).data.publicUrl,title:f.name})};

/* realtime wiring */
function bind(){
  ch.on('presence',{event:'sync'},()=>{users=Object.entries(ch.presenceState()).map(([id,a])=>({id,...a[0]}));
    users.filter(u=>!prev.includes(u.id)&&u.id!==me.id).forEach(u=>sys(u.name+' joined'));
    prev.filter(id=>!users.some(u=>u.id===id)).forEach(id=>sys('Someone left'));prev=users.map(u=>u.id);renderRoom();mesh()});
  on('hello',p=>{if(isHost()&&p.from!==me.id)emit('snap',{to:p.from,video:curVideo,browse:browseUrl,polls,reacts,open,over,
    st:{playing:!!player?.playing(),time:player?.time()||0}})});
  on('snap',p=>{if(p.to!==me.id)return;open=p.open;over=p.over;polls=p.polls||{};reacts=p.reacts||[];
    Object.values(polls).forEach(drawPoll);if(p.browse)setBrowse(p.browse);renderRoom();
    if(p.video)load(p.video).then(()=>{heat();setTimeout(()=>apply(p.st),1500)})});
  on('video',p=>{if(allowed(p.from))load(p)});
  on('state',p=>{if(allowed(p.from))apply(p)});
  on('browse',p=>{if(!allowed(p.from))return;setBrowse(p.u);sys('Browse page shared');$('[data-t=browse]').click()});
  on('open',p=>{if(p.from===hostId()){open=p.v;renderRoom()}});
  on('makehost',p=>{if(p.from===hostId()){over=p.id;renderRoom()}});
  on('kick',p=>{if(p.id===me.id&&p.from===hostId()){ch.unsubscribe();document.body.innerHTML='<p style="padding:2rem">The host removed you from this room.</p>'}});
  on('chat',m=>{chatLog.push(m.name+': '+m.text);
    const img=/^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(m.text);
    $('#log').insertAdjacentHTML('beforeend',`<div class="m"><b style="color:${m.color}">${esc(m.name)}</b>${img?`<img src="${esc(m.text)}" alt="gif">`:esc(m.text)}</div>`);$('#log').scrollTop=1e9});
  let tc;on('typing',p=>{$('#typing').textContent=p.n+' is typing…';clearTimeout(tc);tc=setTimeout(()=>$('#typing').textContent='',2000)});
  on('react',p=>{reacts.push({e:p.e,t:p.t});heat();const s=document.createElement('span');s.textContent=p.e;s.style.left=10+Math.random()*80+'%';
    $('#float').append(s);setTimeout(()=>s.remove(),2600)});
  on('poll',p=>{polls[p.poll.id]=p.poll;drawPoll(p.poll);sys('New poll: '+p.poll.q)});
  on('vote',p=>{const o=polls[p.id];if(o){o.votes[p.from]=p.i;drawPoll(o)}});
  on('count',p=>{if(!allowed(p.from))return;let n=3;const el=$('#cd');if(isHost())player?.pause();
    const tick=()=>{el.textContent=n>0?n:'Go!';el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
      if(n--<=0){clearInterval(iv);if(isHost())player?.play()}};tick();const iv=setInterval(tick,1000)});
  on('signal',async p=>{if(p.to!==me.id||!inCall)return;let pc=peers[p.from],d=p.data;
    if(d.d){pc=pc||mk(p.from);await pc.setRemoteDescription(d.d);
      if(d.d.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());emit('signal',{to:p.from,data:{d:pc.localDescription}})}}
    else if(d.c&&pc)pc.addIceCandidate(d.c).catch(()=>{})})}
const setBrowse=u=>{browseUrl=u;$('#frame').src=u;$('#ext').href=u;$('#url').value=u};
function renderRoom(){const h=hostId();$('#open').checked=open;$('#open').disabled=!isHost();
  $('#role').textContent=isHost()?'You are the host':'Host: '+nameOf(h);
  $('#ppl').innerHTML=users.map(u=>`<li><span class="dot" style="background:${u.color}"></span><b>${esc(u.name)}${u.id===h?' 👑':''}${u.call?' 🎙':''}</b>
  ${isHost()&&u.id!==me.id?`<button data-h="${u.id}">Make host</button><button data-k="${u.id}" class="ghost">Kick</button>`:''}</li>`).join('')}
$('#open').onchange=e=>emitL('open',{v:e.target.checked});
$('#ppl').onclick=e=>{const b=e.target;b.dataset.h&&emitL('makehost',{id:b.dataset.h});b.dataset.k&&emit('kick',{id:b.dataset.k})};
$('#count').onclick=()=>canCtl()?emitL('count'):sys('Only the host can start a countdown.');

/* chat, reactions, GIFs */
function sys(t){$('#log').insertAdjacentHTML('beforeend',`<div class="sys">${esc(t)}</div>`);$('#log').scrollTop=1e9}
function send(){const t=$('#msg').value.trim();if(!t)return;$('#msg').value='';
  if(t==='/roll')return emitL('chat',{text:'🎲 rolled '+(1+Math.floor(Math.random()*20))+' (d20)',name:me.name,color:me.color});
  if(t.startsWith('/poll'))return aiPoll();emitL('chat',{text:t,name:me.name,color:me.color})}
$('#send').onclick=send;let tt=0;
$('#msg').oninput=()=>{if(Date.now()-tt>1500){tt=Date.now();emit('typing',{n:me.name})}};
$('#msg').onkeydown=e=>e.key==='Enter'&&send();
$('#emojis').innerHTML=['🔥','😂','😍','😮','👏','💀','🎉'].map(e=>`<button>${e}</button>`).join('');
$('#emojis').onclick=e=>e.target.tagName==='BUTTON'&&emitL('react',{e:e.target.textContent,t:player?.time()||0});
function heat(){const d=Math.max(player?.dur?.()||0,...reacts.map(r=>r.t+10),60),b=Array.from({length:Math.ceil(d/10)},()=>[]);
  reacts.forEach(r=>b[Math.floor(r.t/10)]?.push(r.e));const mx=Math.max(1,...b.map(x=>x.length));
  $('#heat').innerHTML=b.map((x,i)=>`<i data-t="${i*10}" title="${x.join('')}" style="height:${6+x.length/mx*28}px;opacity:${x.length?1:.25}"></i>`).join('')}
$('#heat').onclick=e=>{const t=e.target.dataset.t;t&&canCtl()&&player&&player.seek(+t)};heat();
let gt;async function gifs(){const q=$('#gq').value.trim(),d=await(await fetch('/api/giphy?q='+encodeURIComponent(q))).json();
  $('#gg').innerHTML=d.error?`<p class="hint">${esc(d.error)}</p>`:d.gifs.map(g=>`<img src="${g.p}" data-u="${g.u}" alt="gif">`).join('')}
$('#gif').onclick=()=>{$('#gifs').hidden=!$('#gifs').hidden;$('#gifs').hidden||gifs()};
$('#gq').oninput=()=>{clearTimeout(gt);gt=setTimeout(gifs,350)};
$('#gg').onclick=e=>{if(e.target.dataset.u){emitL('chat',{text:e.target.dataset.u,name:me.name,color:me.color});$('#gifs').hidden=true}};

/* polls */
async function aiPoll(){$('#ai').textContent='Claude is thinking…';
  try{const p=await(await fetch('/api/poll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,chat:chatLog})})).json();
    emitL('poll',{poll:{id:Date.now()+'',q:p.q,options:p.options.slice(0,5),votes:{}}})}
  finally{$('#ai').textContent='Ask Claude for a poll about this video'}}
$('#ai').onclick=aiPoll;
function drawPoll(p){let el=$('#poll'+p.id);if(!el){el=document.createElement('div');el.id='poll'+p.id;el.className='poll';$('#pl').prepend(el);
    el.onclick=e=>{const b=e.target.closest('.opt');b&&emitL('vote',{id:p.id,i:+b.dataset.i})}}
  const v=Object.values(p.votes),c=p.options.map((_,i)=>v.filter(x=>x===i).length);
  el.innerHTML=`<h4>${esc(p.q)}</h4>`+p.options.map((o,i)=>`<button class="opt" data-i="${i}"><i style="width:${v.length?c[i]/v.length*100:0}%"></i><span>${esc(o)}<em>${c[i]}${p.votes[me.id]===i?' ✓':''}</em></span></button>`).join('')}

/* voice + video mesh; the higher id always makes the offer, so offers never collide */
const ice={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
function tile(id,s,self){let t=$('#t-'+id);if(!t){t=document.createElement('div');t.id='t-'+id;t.className='tile';
  t.innerHTML=`<video autoplay playsinline ${self?'muted':''}></video><b>${self?'You':esc(nameOf(id))}</b>`;$('#tiles').append(t)}t.firstChild.srcObject=s}
function mk(id){const pc=new RTCPeerConnection(ice);peers[id]=pc;stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  pc.onicecandidate=e=>e.candidate&&emit('signal',{to:id,data:{c:e.candidate}});pc.ontrack=e=>tile(id,e.streams[0]);return pc}
async function offer(id){const pc=mk(id);await pc.setLocalDescription(await pc.createOffer());emit('signal',{to:id,data:{d:pc.localDescription}})}
function drop(id){peers[id]?.close();delete peers[id];$('#t-'+id)?.remove()}
function mesh(){if(!inCall)return;users.filter(u=>u.call&&u.id!==me.id&&!peers[u.id]&&me.id>u.id).forEach(u=>offer(u.id));
  Object.keys(peers).forEach(id=>{if(!users.some(u=>u.id===id&&u.call))drop(id)})}
$('#call').onclick=async()=>{
  if(inCall){stream.getTracks().forEach(t=>t.stop());Object.keys(peers).forEach(drop);$('#tiles').innerHTML='';inCall=false;await track();
    $('#call').textContent='Join voice & video';$('#mic').hidden=$('#cam').hidden=true;return}
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true})}
  catch{try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch{return sys('Mic/camera blocked. Allow access in your browser.')}}
  inCall=true;tile('me',stream,true);await track();$('#call').textContent='Leave call';$('#mic').hidden=$('#cam').hidden=false};
const toggle=(k,b)=>{const t=stream.getTracks().filter(x=>x.kind===k);t.forEach(x=>x.enabled=!x.enabled);b.style.opacity=t[0]?.enabled?1:.45};
$('#mic').onclick=e=>toggle('audio',e.target);$('#cam').onclick=e=>toggle('video',e.target);
