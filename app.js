const API_BASE="https://script.google.com/macros/s/AKfycbxPSpsOkNbSd4JUjv4ZqK1ZfmFxZCL-6A4wMPK4vuZHfq4OZ8R6qOwy7LQDLURQv71W_w/exec";

const $=id=>document.getElementById(id);
const els={
  homeView:$('homeView'),
  playerView:$('playerView'),
  lessonList:$('lessonList'),
  lessonCount:$('lessonCount'),
  status:$('status'),
  reloadBtn:$('reloadBtn'),
  heroContinueBtn:$('heroContinueBtn'),
  backBtn:$('backBtn'),
  favoriteBtn:$('favoriteBtn'),
  lessonNo:$('lessonNo'),
  lessonTitle:$('lessonTitle'),
  transcript:$('transcript'),
  modeChip:$('modeChip'),
  audio:$('audio'),
  currentTime:$('currentTime'),
  duration:$('duration'),
  seekBar:$('seekBar'),
  rewindBtn:$('rewindBtn'),
  forwardBtn:$('forwardBtn'),
  playPauseBtn:$('playPauseBtn'),
  playPauseIcon:$('playPauseIcon'),
  speedValue:$('speedValue'),
  repeatInfo:$('repeatInfo'),
  playerNote:$('playerNote')
};

let lessons=[];
let currentLesson=null;
let activeTab='main';
let repeatCount=0;

let playbackMode=localStorage.getItem('playbackMode')||'once';
let playbackSpeed=Number(localStorage.getItem('playbackSpeed'))||1;

const TAB_INFO={
  main:{label:'Main Story',audioField:'MainAudio',transcriptField:'TranscriptEN'},
  vocab:{label:'Vocabulary',audioField:'VocabAudio',transcriptField:'VocabTranscriptEN'},
  mini:{label:'Mini Story',audioField:'MiniAudio',transcriptField:'MiniTranscriptEN'}
};

const MODE_INFO={
  once:{label:'Play once',note:'Phát một lần rồi dừng.'},
  'repeat-one':{label:'Repeat One',note:'Lặp liên tục audio hiện tại. Hoạt động tốt khi khóa màn hình.'},
  'repeat-3':{label:'Repeat 3x',note:'Phát tổng cộng 3 lần rồi dừng.'},
  'lesson-loop':{label:'Lesson Loop',note:'Main → Vocabulary → Mini → Main. Khi khóa màn hình, iOS có thể không cho tự đổi sang file audio mới.'}
};

function isTrue(v){
  return String(v??'').trim().toUpperCase()==='TRUE';
}

function esc(v){
  return String(v??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function fmt(sec){
  if(!Number.isFinite(sec)||sec<0)return '0:00';
  const m=Math.floor(sec/60);
  const s=Math.floor(sec%60);
  return m+':'+String(s).padStart(2,'0');
}

function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb='__ezcb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    const timer=setTimeout(()=>cleanup(new Error('JSONP timeout')),15000);

    function cleanup(err){
      clearTimeout(timer);
      try{delete window[cb];}catch(e){}
      script.remove();
      if(err)reject(err);
    }

    window[cb]=data=>{
      clearTimeout(timer);
      try{delete window[cb];}catch(e){}
      script.remove();
      resolve(data);
    };

    const sep=url.includes('?')?'&':'?';
    script.src=url+sep+'callback='+encodeURIComponent(cb)+'&_='+Date.now();
    script.onerror=()=>cleanup(new Error('JSONP load failed'));
    document.head.appendChild(script);
  });
}

async function getLessonsData(){
  const url=API_BASE+'?sheet=Lessons&_='+Date.now();
  try{
    const res=await fetch(url,{cache:'no-store',credentials:'omit'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(fetchError){
    console.warn('Fetch failed. Trying JSONP.',fetchError);
    return await jsonp(API_BASE+'?sheet=Lessons');
  }
}

async function loadLessons(){
  els.status.textContent='Đang tải dữ liệu...';
  els.lessonList.innerHTML='';
  try{
    const result=await getLessonsData();
    if(!result||result.ok!==true||!Array.isArray(result.data)){
      throw new Error('API trả dữ liệu không đúng cấu trúc');
    }

    lessons=result.data
      .filter(x=>String(x.CourseID||'').trim()==='OE'&&isTrue(x.Active))
      .sort((a,b)=>Number(a.SortOrder||a.LessonNo||0)-Number(b.SortOrder||b.LessonNo||0));

    els.lessonCount.textContent=lessons.length+' lessons';
    els.status.textContent=lessons.length?'':'Chưa có bài học.';
    renderLessons();
  }catch(err){
    console.error(err);
    els.status.textContent='Không tải được danh sách bài học.';
  }
}

function renderLessons(){
  els.lessonList.innerHTML='';

  lessons.forEach((lesson,index)=>{
    const btn=document.createElement('button');
    btn.className='lesson-card';

    const no=lesson.LessonNo||index+1;
    const duration=lesson.DurationSec?fmt(Number(lesson.DurationSec)):'3 audio parts';

    btn.innerHTML=`
      <span class="lesson-thumb">${esc(String(no).padStart(2,'0'))}</span>
      <span class="lesson-main">
        <span class="lesson-title">${esc(lesson.Title||('Lesson '+no))}</span>
        <span class="lesson-meta">
          <span>Lesson ${esc(no)}</span>
          <span>•</span>
          <span>${esc(duration)}</span>
        </span>
        <span class="lesson-progress"><span></span></span>
      </span>
      <span class="chevron">›</span>
    `;

    btn.addEventListener('click',()=>openLesson(lesson));
    els.lessonList.appendChild(btn);
  });
}

function showView(name){
  const player=name==='player';
  els.homeView.classList.toggle('hidden',player);
  els.playerView.classList.toggle('hidden',!player);

  document.querySelectorAll('.nav-item').forEach(btn=>{
    const nav=btn.dataset.nav;
    const active=player ? nav==='player' : (name==='lessons'?nav==='lessons':nav==='home');
    btn.classList.toggle('active',active);
  });

  if(!player){
    window.scrollTo({top:name==='lessons'?Math.max(0,document.querySelector('.section-block')?.offsetTop-18):0,behavior:'smooth'});
  }else{
    window.scrollTo({top:0,behavior:'instant'});
  }
}

function openLesson(lesson){
  currentLesson=lesson;
  activeTab='main';
  repeatCount=0;

  els.lessonNo.textContent='Lesson '+(lesson.LessonNo||'');
  els.lessonTitle.textContent=lesson.Title||'Lesson';

  updateTabs();
  applyPlaybackModeUI();
  applyPlaybackSpeed();
  loadActiveMedia();
  showView('player');
}

function closePlayer(){
  els.audio.pause();
  showView('home');
}

function updateTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.tab===activeTab);
  });
}

function applyPlaybackSpeed(){
  els.audio.playbackRate=playbackSpeed;
  els.speedValue.textContent=playbackSpeed+'x';

  document.querySelectorAll('.speed-btn').forEach(btn=>{
    const speed=Number(btn.dataset.speed);
    btn.classList.toggle('active',speed===playbackSpeed);
  });
}

function applyPlaybackModeUI(){
  // Repeat One dùng native audio.loop để ổn định trên iPhone, kể cả lock screen.
  els.audio.loop=(playbackMode==='repeat-one');

  document.querySelectorAll('.mode-btn').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.mode===playbackMode);
  });

  const info=MODE_INFO[playbackMode]||MODE_INFO.once;
  els.repeatInfo.textContent=info.label;
  els.playerNote.innerHTML='<span>💡</span><span>'+esc(info.note)+'</span>';
}

function updateMediaSession(){
  if(!currentLesson||!('mediaSession'in navigator))return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:currentLesson.Title||'EZ English',
      artist:TAB_INFO[activeTab].label,
      album:'Original Effortless English'
    });
  }catch(e){}
}

function loadActiveMedia(){
  if(!currentLesson)return;

  const info=TAB_INFO[activeTab];
  const url=String(currentLesson[info.audioField]||'').trim();
  const txt=String(currentLesson[info.transcriptField]||'').trim();

  els.modeChip.textContent=info.label;
  els.transcript.textContent=txt||(info.label+' transcript chưa có.');

  els.audio.pause();
  els.audio.removeAttribute('src');

  if(url){
    els.audio.src=url;
  }

  els.audio.load();
  applyPlaybackSpeed();
  applyPlaybackModeUI();
  updateMediaSession();
  updateTimeline();
}

function switchTabAndPlay(nextTab){
  activeTab=nextTab;
  repeatCount=0;
  updateTabs();
  loadActiveMedia();

  const playAfterLoad=()=>{
    els.audio.removeEventListener('canplay',playAfterLoad);
    els.audio.play().catch(()=>{});
  };

  if(els.audio.readyState>=2){
    els.audio.play().catch(()=>{});
  }else{
    els.audio.addEventListener('canplay',playAfterLoad);
  }
}

function handleEnded(){
  if(!currentLesson)return;

  if(playbackMode==='once'){
    repeatCount=0;
    updatePlayButton();
    return;
  }

  // repeat-one được xử lý bằng native audio.loop = true

  if(playbackMode==='repeat-3'){
    repeatCount+=1;

    if(repeatCount<3){
      els.audio.currentTime=0;
      els.audio.play().catch(()=>{});
    }else{
      repeatCount=0;
      updatePlayButton();
    }
    return;
  }

  if(playbackMode==='lesson-loop'){
    const next=activeTab==='main'
      ? 'vocab'
      : activeTab==='vocab'
        ? 'mini'
        : 'main';

    switchTabAndPlay(next);
  }
}

function updateTimeline(){
  const duration=els.audio.duration;
  const current=els.audio.currentTime;

  els.currentTime.textContent=fmt(current);
  els.duration.textContent=fmt(duration);

  if(Number.isFinite(duration)&&duration>0){
    els.seekBar.value=Math.round((current/duration)*1000);
  }else{
    els.seekBar.value=0;
  }
}

function updatePlayButton(){
  const playing=!els.audio.paused&&!els.audio.ended;
  els.playPauseIcon.textContent=playing?'❚❚':'▶';
  els.playPauseBtn.setAttribute('aria-label',playing?'Pause':'Play');
}

function configureMediaActions(){
  if(!('mediaSession'in navigator))return;

  const handlers={
    play:()=>els.audio.play(),
    pause:()=>els.audio.pause(),
    seekbackward:details=>{
      const step=details.seekOffset||10;
      els.audio.currentTime=Math.max(0,els.audio.currentTime-step);
    },
    seekforward:details=>{
      const step=details.seekOffset||10;
      const end=Number.isFinite(els.audio.duration)?els.audio.duration:Infinity;
      els.audio.currentTime=Math.min(end,els.audio.currentTime+step);
    },
    seekto:details=>{
      if(details.seekTime!=null)els.audio.currentTime=details.seekTime;
    }
  };

  Object.entries(handlers).forEach(([action,handler])=>{
    try{navigator.mediaSession.setActionHandler(action,handler);}catch(e){}
  });
}

document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(btn.dataset.tab===activeTab)return;
    activeTab=btn.dataset.tab;
    repeatCount=0;
    updateTabs();
    loadActiveMedia();
  });
});

document.querySelectorAll('.speed-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    playbackSpeed=Number(btn.dataset.speed);
    localStorage.setItem('playbackSpeed',String(playbackSpeed));
    applyPlaybackSpeed();
  });
});

document.querySelectorAll('.mode-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    playbackMode=btn.dataset.mode;
    repeatCount=0;
    localStorage.setItem('playbackMode',playbackMode);
    applyPlaybackModeUI();
  });
});

document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const nav=btn.dataset.nav;

    if(nav==='player'){
      if(currentLesson)showView('player');
      else if(lessons.length)openLesson(lessons[0]);
      return;
    }

    showView(nav);
  });
});

els.reloadBtn.addEventListener('click',loadLessons);
els.backBtn.addEventListener('click',closePlayer);
els.heroContinueBtn.addEventListener('click',()=>{
  if(lessons.length)openLesson(lessons[0]);
});

els.favoriteBtn.addEventListener('click',()=>{
  const selected=els.favoriteBtn.textContent==='♥';
  els.favoriteBtn.textContent=selected?'♡':'♥';
});

els.playPauseBtn.addEventListener('click',()=>{
  if(!els.audio.src)return;

  if(els.audio.paused){
    els.audio.play().catch(console.warn);
  }else{
    els.audio.pause();
  }
});

els.rewindBtn.addEventListener('click',()=>{
  els.audio.currentTime=Math.max(0,els.audio.currentTime-10);
});

els.forwardBtn.addEventListener('click',()=>{
  const end=Number.isFinite(els.audio.duration)?els.audio.duration:Infinity;
  els.audio.currentTime=Math.min(end,els.audio.currentTime+10);
});

els.seekBar.addEventListener('input',()=>{
  if(!Number.isFinite(els.audio.duration)||els.audio.duration<=0)return;
  els.audio.currentTime=(Number(els.seekBar.value)/1000)*els.audio.duration;
});

els.audio.addEventListener('play',()=>{
  try{
    if(navigator.audioSession)navigator.audioSession.type='playback';
  }catch(e){}

  try{
    if(navigator.mediaSession)navigator.mediaSession.playbackState='playing';
  }catch(e){}

  updatePlayButton();
  updateMediaSession();
});

els.audio.addEventListener('pause',()=>{
  try{
    if(navigator.mediaSession)navigator.mediaSession.playbackState='paused';
  }catch(e){}

  updatePlayButton();
});

els.audio.addEventListener('loadedmetadata',()=>{
  applyPlaybackSpeed();
  updateTimeline();
});

els.audio.addEventListener('timeupdate',updateTimeline);
els.audio.addEventListener('durationchange',updateTimeline);
els.audio.addEventListener('ended',handleEnded);
els.audio.addEventListener('error',()=>{
  console.warn('Audio error',els.audio.error);
});

configureMediaActions();
applyPlaybackModeUI();
applyPlaybackSpeed();
loadLessons();

if('serviceWorker'in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=2.0');
      await reg.update();
    }catch(e){
      console.warn('Service Worker update failed',e);
    }
  });
}
