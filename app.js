
const API_BASE="https://script.google.com/macros/s/AKfycbxPSpsOkNbSd4JUjv4ZqK1ZfmFxZCL-6A4wMPK4vuZHfq4OZ8R6qOwy7LQDLURQv71W_w/exec";
const $=id=>document.getElementById(id);
const els={listView:$('listView'),playerView:$('playerView'),lessonList:$('lessonList'),status:$('status'),
reloadBtn:$('reloadBtn'),backBtn:$('backBtn'),lessonNo:$('lessonNo'),lessonTitle:$('lessonTitle'),
transcript:$('transcript'),modeLabel:$('modeLabel'),audioStatus:$('audioStatus'),audio:$('audio'),
rewindBtn:$('rewindBtn'),forwardBtn:$('forwardBtn'),playbackMode:$('playbackMode'),repeatInfo:$('repeatInfo')};

let lessons=[],currentLesson=null,activeTab='main';
let playbackMode=localStorage.getItem('playbackMode')||'once';
let repeatCount=0;

const TAB_INFO={
main:{label:'Main Story',audioField:'MainAudio',transcriptField:'TranscriptEN'},
vocab:{label:'Vocabulary',audioField:'VocabAudio',transcriptField:'VocabTranscriptEN'},
mini:{label:'Mini Story',audioField:'MiniAudio',transcriptField:'MiniTranscriptEN'}
};

const isTrue=v=>String(v??'').trim().toUpperCase()==='TRUE';

async function loadLessons(){
  els.status.textContent='Đang tải dữ liệu...';
  try{
    const r=await fetch(API_BASE+'?sheet=Lessons&_='+Date.now(),{cache:'no-store'});
    const result=await r.json();
    lessons=result.data.filter(x=>String(x.CourseID||'').trim()==='OE'&&isTrue(x.Active))
      .sort((a,b)=>Number(a.SortOrder||a.LessonNo||0)-Number(b.SortOrder||b.LessonNo||0));
    els.status.textContent=lessons.length+' bài học';
    renderLessons();
  }catch(e){
    els.status.textContent='Không tải được Lessons';
    console.error(e);
  }
}

function renderLessons(){
  els.lessonList.innerHTML='';
  lessons.forEach(l=>{
    const b=document.createElement('button');
    b.className='lesson-card';
    b.innerHTML=`<span class="lesson-num">${l.LessonNo||''}</span>
    <span><span class="lesson-title">${l.Title||'Lesson'}</span>
    <span class="lesson-meta">Original Effortless English</span></span><span>›</span>`;
    b.onclick=()=>openLesson(l);
    els.lessonList.appendChild(b);
  });
}

function openLesson(l){
  currentLesson=l;activeTab='main';repeatCount=0;
  els.listView.classList.add('hidden');els.playerView.classList.remove('hidden');
  els.lessonNo.textContent='Lesson '+(l.LessonNo||'');els.lessonTitle.textContent=l.Title||'Lesson';
  updateTabs();loadActiveMedia();
}

function closePlayer(){
  els.audio.pause();els.audio.removeAttribute('src');els.audio.load();
  currentLesson=null;els.playerView.classList.add('hidden');els.listView.classList.remove('hidden');
}

function updateTabs(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));}

function loadActiveMedia(){
  if(!currentLesson)return;
  const info=TAB_INFO[activeTab];
  const url=String(currentLesson[info.audioField]||'').trim();
  const txt=String(currentLesson[info.transcriptField]||'').trim();
  els.modeLabel.textContent=info.label;
  els.transcript.textContent=txt||(info.label+' transcript chưa có.');
  els.audio.pause();
  els.audio.src=url;
  els.audio.load();
  try{if(navigator.mediaSession)navigator.mediaSession.metadata=new MediaMetadata({title:currentLesson.Title||'EZ English',artist:info.label,album:'Original Effortless English'});}catch(e){}
}

function applyPlaybackModeUI(){
  els.playbackMode.value=playbackMode;
  if(playbackMode==='once')els.repeatInfo.textContent='Phát 1 lần rồi dừng.';
  if(playbackMode==='repeat-one')els.repeatInfo.textContent='Tự phát lại audio hiện tại liên tục.';
  if(playbackMode==='repeat-3')els.repeatInfo.textContent='Phát tổng cộng 3 lần rồi dừng.';
  if(playbackMode==='lesson-loop')els.repeatInfo.textContent='Main → Vocabulary → Mini → Main...';
}

function switchTabAndPlay(nextTab){
  activeTab=nextTab;repeatCount=0;updateTabs();loadActiveMedia();
  const playNow=()=>{els.audio.removeEventListener('canplay',playNow);els.audio.play().catch(()=>{});};
  els.audio.addEventListener('canplay',playNow);
}

function handleEnded(){
  if(playbackMode==='once')return;

  if(playbackMode==='repeat-one'){
    els.audio.currentTime=0;els.audio.play().catch(()=>{});return;
  }

  if(playbackMode==='repeat-3'){
    repeatCount++;
    if(repeatCount<3){
      els.repeatInfo.textContent='Repeat 3x: lần '+(repeatCount+1)+'/3';
      els.audio.currentTime=0;els.audio.play().catch(()=>{});
    }else{
      els.repeatInfo.textContent='Repeat 3x: hoàn thành 3/3';repeatCount=0;
    }
    return;
  }

  if(playbackMode==='lesson-loop'){
    const next=activeTab==='main'?'vocab':activeTab==='vocab'?'mini':'main';
    switchTabAndPlay(next);
  }
}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  if(b.dataset.tab===activeTab)return;
  repeatCount=0;activeTab=b.dataset.tab;updateTabs();loadActiveMedia();
});

els.playbackMode.onchange=()=>{
  playbackMode=els.playbackMode.value;repeatCount=0;
  localStorage.setItem('playbackMode',playbackMode);
  applyPlaybackModeUI();
};

els.backBtn.onclick=closePlayer;els.reloadBtn.onclick=loadLessons;
els.rewindBtn.onclick=()=>els.audio.currentTime=Math.max(0,els.audio.currentTime-10);
els.forwardBtn.onclick=()=>{const end=Number.isFinite(els.audio.duration)?els.audio.duration:Infinity;els.audio.currentTime=Math.min(end,els.audio.currentTime+10);};
els.audio.addEventListener('ended',handleEnded);
els.audio.addEventListener('play',()=>{try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(e){}});

applyPlaybackModeUI();
loadLessons();
