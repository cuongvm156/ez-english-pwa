const API_BASE="https://script.google.com/macros/s/AKfycbxPSpsOkNbSd4JUjv4ZqK1ZfmFxZCL-6A4wMPK4vuZHfq4OZ8R6qOwy7LQDLURQv71W_w/exec";
const $=id=>document.getElementById(id);
const els={listView:$('listView'),playerView:$('playerView'),lessonList:$('lessonList'),status:$('status'),reloadBtn:$('reloadBtn'),backBtn:$('backBtn'),lessonNo:$('lessonNo'),lessonTitle:$('lessonTitle'),transcript:$('transcript'),modeLabel:$('modeLabel'),audioStatus:$('audioStatus'),audio:$('audio'),rewindBtn:$('rewindBtn'),forwardBtn:$('forwardBtn'),debug:$('debug')};
let lessons=[],currentLesson=null,activeTab='main';
const TAB_INFO={
 main:{label:'Main Story',audioField:'MainAudio',transcriptField:'TranscriptEN'},
 vocab:{label:'Vocabulary',audioField:'VocabAudio',transcriptField:'VocabTranscriptEN'},
 mini:{label:'Mini Story',audioField:'MiniAudio',transcriptField:'MiniTranscriptEN'}
};
const isTrue=v=>String(v??'').trim().toUpperCase()==='TRUE';

function jsonp(url){
 return new Promise((resolve,reject)=>{
   const cb='__ezcb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
   const s=document.createElement('script');
   const t=setTimeout(()=>done(new Error('JSONP timeout')),15000);
   function done(err){clearTimeout(t);delete window[cb];s.remove();if(err)reject(err);}
   window[cb]=data=>{clearTimeout(t);delete window[cb];s.remove();resolve(data);};
   const sep=url.includes('?')?'&':'?';
   s.src=url+sep+'callback='+encodeURIComponent(cb)+'&_='+Date.now();
   s.onerror=()=>done(new Error('JSONP load failed'));
   document.head.appendChild(s);
 });
}

async function getLessonsData(){
 const url=API_BASE+'?sheet=Lessons&_='+Date.now();
 try{
   const r=await fetch(url,{cache:'no-store',credentials:'omit'});
   if(!r.ok) throw new Error('HTTP '+r.status);
   return await r.json();
 }catch(e){
   console.warn('fetch failed; try JSONP',e);
   return await jsonp(API_BASE+'?sheet=Lessons');
 }
}

async function loadLessons(){
 els.status.textContent='Đang tải dữ liệu...';els.status.classList.remove('error');els.lessonList.innerHTML='';
 try{
   const result=await getLessonsData();
   if(!result||result.ok!==true||!Array.isArray(result.data)) throw new Error('API sai cấu trúc');
   lessons=result.data.filter(x=>String(x.CourseID||'').trim()==='OE'&&isTrue(x.Active))
     .sort((a,b)=>Number(a.SortOrder||a.LessonNo||0)-Number(b.SortOrder||b.LessonNo||0));
   els.status.textContent=lessons.length+' bài học';renderLessons();
 }catch(e){
   els.status.textContent='Không tải được Lessons: '+e.message+' (nếu là CORS, cập nhật Apps Script theo hướng dẫn).';
   els.status.classList.add('error');console.error(e);
 }
}

function renderLessons(){
 els.lessonList.innerHTML='';
 lessons.forEach(l=>{
   const b=document.createElement('button');b.className='lesson-card';
   const n=String(l.LessonNo||l.SortOrder||'');const dur=l.DurationSec?fmt(Number(l.DurationSec)):'';
   b.innerHTML=`<span class="lesson-num">${esc(n)}</span><span><span class="lesson-title">${esc(l.Title||'Lesson')}</span><span class="lesson-meta">${dur?'Main · '+dur:'Original Effortless English'}</span></span><span>›</span>`;
   b.onclick=()=>openLesson(l);els.lessonList.appendChild(b);
 });
}

function openLesson(l){
 savePos();currentLesson=l;activeTab='main';els.listView.classList.add('hidden');els.playerView.classList.remove('hidden');
 els.lessonNo.textContent='Lesson '+(l.LessonNo||'');els.lessonTitle.textContent=l.Title||'Lesson';updateTabs();loadActiveMedia();window.scrollTo(0,0);
}
function closePlayer(){savePos();els.audio.pause();els.audio.removeAttribute('src');els.audio.load();currentLesson=null;els.playerView.classList.add('hidden');els.listView.classList.remove('hidden');}
function updateTabs(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));}
function posKey(){return currentLesson?'pos:'+currentLesson.LessonID+':'+activeTab:'';}
function savePos(){if(!currentLesson||!Number.isFinite(els.audio.currentTime))return;try{localStorage.setItem(posKey(),String(els.audio.currentTime));}catch(e){}}
function restorePos(){try{const v=Number(localStorage.getItem(posKey())||0);if(v>0&&Number.isFinite(els.audio.duration)&&v<els.audio.duration-2)els.audio.currentTime=v;}catch(e){}}

function loadActiveMedia(){
 if(!currentLesson)return;
 const info=TAB_INFO[activeTab],url=String(currentLesson[info.audioField]||'').trim(),txt=String(currentLesson[info.transcriptField]||'').trim();
 els.modeLabel.textContent=info.label;els.transcript.textContent=txt||(info.label+' transcript chưa có.');els.audioStatus.textContent=url?'Ready':'Chưa có audio URL';
 if((els.audio.dataset.url||'')!==url){
   els.audio.pause();els.audio.dataset.url=url;
   if(url){els.audio.src=url;els.audio.load();}else{els.audio.removeAttribute('src');els.audio.load();}
 }
 updateMediaSession();updateDebug(url);
}

function updateDebug(url){
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 els.debug.textContent='PWA standalone: '+standalone+'\nTab: '+activeTab+'\nLessonID: '+(currentLesson?.LessonID||'')+'\nAudio: '+(url||'(empty)')+'\naudioSession API: '+('audioSession'in navigator)+'\nMediaSession API: '+('mediaSession'in navigator);
}
function updateMediaSession(){
 if(!currentLesson||!('mediaSession'in navigator))return;
 try{navigator.mediaSession.metadata=new MediaMetadata({title:currentLesson.Title||'EZ English',artist:TAB_INFO[activeTab].label,album:'Original Effortless English'});}catch(e){}
}
function setMediaPosition(){
 if(!('mediaSession'in navigator)||!navigator.mediaSession.setPositionState)return;
 const d=els.audio.duration,p=els.audio.currentTime;if(!Number.isFinite(d)||d<=0||!Number.isFinite(p))return;
 try{navigator.mediaSession.setPositionState({duration:d,playbackRate:els.audio.playbackRate||1,position:Math.min(Math.max(p,0),d)});}catch(e){}
}
function configureActions(){
 if(!('mediaSession'in navigator))return;
 const h={play:()=>els.audio.play(),pause:()=>els.audio.pause(),
  seekbackward:d=>{els.audio.currentTime=Math.max(0,els.audio.currentTime-(d.seekOffset||10));},
  seekforward:d=>{const end=Number.isFinite(els.audio.duration)?els.audio.duration:Infinity;els.audio.currentTime=Math.min(end,els.audio.currentTime+(d.seekOffset||10));},
  seekto:d=>{if(d.seekTime!=null)els.audio.currentTime=d.seekTime;}
 };
 Object.entries(h).forEach(([a,f])=>{try{navigator.mediaSession.setActionHandler(a,f);}catch(e){}});
}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{if(b.dataset.tab===activeTab)return;savePos();activeTab=b.dataset.tab;updateTabs();loadActiveMedia();});
els.backBtn.onclick=closePlayer;els.reloadBtn.onclick=loadLessons;
els.rewindBtn.onclick=()=>els.audio.currentTime=Math.max(0,els.audio.currentTime-10);
els.forwardBtn.onclick=()=>{const end=Number.isFinite(els.audio.duration)?els.audio.duration:Infinity;els.audio.currentTime=Math.min(end,els.audio.currentTime+10);};
els.audio.addEventListener('play',()=>{try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(e){}try{if(navigator.mediaSession)navigator.mediaSession.playbackState='playing';}catch(e){}els.audioStatus.textContent='Playing';updateMediaSession();setMediaPosition();});
els.audio.addEventListener('pause',()=>{try{if(navigator.mediaSession)navigator.mediaSession.playbackState='paused';}catch(e){}els.audioStatus.textContent='Paused';savePos();setMediaPosition();});
els.audio.addEventListener('loadedmetadata',()=>{restorePos();setMediaPosition();});
els.audio.addEventListener('timeupdate',()=>{setMediaPosition();if(Math.floor(els.audio.currentTime)%10===0)savePos();});
els.audio.addEventListener('error',()=>{els.audioStatus.textContent='Audio error '+(els.audio.error?.code||'?');});

function fmt(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0');}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}

configureActions();loadLessons();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
