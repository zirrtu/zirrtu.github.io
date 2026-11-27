"use strict";
(() => {
  const get = id => document.getElementById(id);
  const envelope = JSON.parse(get("audio-envelopes").textContent);
  const playerTemplate = get("transport");
  const offline = Boolean(get("embedded-media"));
  const blobs = new Map();
  const registry = new Map();
  const canvases = new WeakMap();
  const localeLink = get("language");
  let language = new URLSearchParams(location.search).get("lang")==="zh" ? "zh" : "en";
  let current = null;
  const local = (en,zh) => language==="zh" ? zh : en;
  const clock = value => {
    const seconds = Math.max(0,Math.floor(value));
    return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
  };

  function attach(a) {
    if(!offline || a.hasAttribute("src"))return;
    const key=a.dataset.clip;
    if(!blobs.has(key)) {
      const encoded=get("snd-"+key).textContent;
      const binary=atob(encoded);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);
      blobs.set(key,URL.createObjectURL(new Blob([bytes],{type:"audio/flac"})));
    }
    a.src=blobs.get(key);
  }

  function plot(v, progress) {
    const width=v.canvas.clientWidth, height=v.canvas.clientHeight;
    if(!width || !height)return;
    const scale=Math.min(window.devicePixelRatio||1,2);
    const columns=Math.min(v.data.bars.length,Math.max(6,Math.floor(width/3)));
    const reached=Math.round(Math.min(1,progress)*columns);
    if(v.canvas.width===Math.round(width*scale) && v.canvas.height===Math.round(height*scale) && v.reached===reached)return;
    v.reached=reached;
    v.canvas.width=Math.round(width*scale);v.canvas.height=Math.round(height*scale);
    const ctx=v.canvas.getContext("2d");
    if(!ctx)return;
    ctx.setTransform(scale,0,0,scale,0,0);
    const step=width/columns, bar=Math.max(1,step*.64);
    for(let i=0;i<columns;i++){
      const level=v.data.bars[Math.floor((i+.5)*v.data.bars.length/columns)];
      const amount=Math.max(2,height*level/100);
      ctx.fillStyle=i<reached ? (v.ours?"#83632f":"#494d54") : (v.ours?"#cfba92":"#c8cdd0");
      ctx.fillRect(i*step+(step-bar)/2,(height-amount)/2,bar,amount);
    }
  }
  function sync(v) {
    const a=v.audio;
    const duration=Number.isFinite(a.duration) ? a.duration : v.data.ms/1000;
    const elapsed=v.pending===null ? a.currentTime||0 : v.pending;
    const playing=!a.paused&&!a.ended;
    const title=a.getAttribute("aria-label");
    const action=playing?local("Pause ","暂停 "):local("Play ","播放 ");
    v.toggle.setAttribute("aria-label",action+title);
    v.toggle.setAttribute("aria-pressed",String(playing));
    v.seek.setAttribute("aria-label",local("Seek ","调整播放位置 ")+title);
    v.seek.max=duration;v.seek.value=elapsed;
    v.seek.setAttribute("aria-valuetext",clock(elapsed)+" / "+clock(duration));
    v.time.textContent=playing || (elapsed>0&&!a.ended) ? clock(elapsed) : clock(Math.round(duration));
    plot(v,duration?elapsed/duration:0);
  }
  function seek(v) {
    const value=Number(v.seek.value);
    attach(v.audio);
    if(v.audio.readyState>=1) {
      v.pending=null;
      v.audio.currentTime=value;
    } else {
      v.pending=value;
      if(v.audio.networkState!==v.audio.NETWORK_LOADING)v.audio.load();
    }
    sync(v);
  }
  function playFailed(v,err) {
    if(err && err.name==="AbortError")return;
    const text=local("Audio could not be played.","音频暂时无法播放。");
    get("play-error").textContent=text;
    v.toggle.title=text;
    v.time.textContent="—";
  }
  async function toggle(v) {
    const a=v.audio;
    if(!a.paused&&!a.ended){a.pause();return;}
    if(current&&current!==a)current.pause();
    current=a;
    attach(a);
    if(a.ended)a.currentTime=0;
    try{await a.play();}catch(err){playFailed(v,err);}
  }

  const sizeObserver=typeof ResizeObserver==="function" ? new ResizeObserver(entries=>{
    for(const item of entries){const v=canvases.get(item.target);if(v)sync(v);}
  }) : null;
  for(const a of document.querySelectorAll("audio[data-clip]")){
    const root=a.closest(".track");
    const ui=playerTemplate.content.firstElementChild.cloneNode(true);
    const v={audio:a,data:envelope[a.dataset.clip],toggle:ui.querySelector(".toggle"),seek:ui.querySelector(".seek"),time:ui.querySelector(".time"),canvas:ui.querySelector("canvas"),ours:root.closest("td").classList.contains("ours"),pending:null,reached:-1};
    registry.set(a,v);root.appendChild(ui);
    v.toggle.addEventListener("click",()=>toggle(v));
    v.seek.addEventListener("input",()=>seek(v));
    a.addEventListener("loadedmetadata",()=>{
      if(v.pending!==null){a.currentTime=Math.min(a.duration,v.pending);v.pending=null;}
      sync(v);
    });
    for(const event of ["play","pause","timeupdate","ended","seeked"])a.addEventListener(event,()=>sync(v));
    root.classList.add("enhanced");
    canvases.set(v.canvas,v);
    if(sizeObserver)sizeObserver.observe(v.canvas);
    sync(v);
  }
  document.addEventListener("play",event=>{
    if(!(event.target instanceof HTMLAudioElement))return;
    if(current&&current!==event.target)current.pause();
    current=event.target;
  },true);
  window.addEventListener("pagehide",()=>{if(current)current.pause();});

  function filter(select) {
    const table=get("grid-"+select.dataset.for);
    for(const row of table.tBodies[0].rows){
      row.hidden=select.value!=="all"&&row.dataset.family!==select.value;
      if(row.hidden&&current&&row.contains(current))current.pause();
    }
    if(!sizeObserver)for(const v of registry.values())sync(v);
  }
  for(const select of document.querySelectorAll("select[data-for]")){
    select.closest(".select-wrap").hidden=false;
    select.addEventListener("change",()=>filter(select));
    filter(select);
  }
  function openTarget(){
    let id;
    try{id=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
    if(!id)return;
    const row=get(id);
    if(!row || row.tagName!=="TR" || !row.hidden)return;
    const select=get("filter-"+row.closest("table").dataset.table);
    if(select){select.value=row.dataset.family;filter(select);row.scrollIntoView({block:"start"});}
  }
  window.addEventListener("hashchange",openTarget);
  openTarget();

  const dialog=get("figure-dialog"),small=get("overview-img"),large=get("large-figure");
  const figureLink=get("figure-link"),close=get("close-figure");
  figureLink.addEventListener("click",event=>{
    if(typeof dialog.showModal!=="function")return;
    event.preventDefault();
    large.src=small.currentSrc||small.src;large.alt=small.alt;
    dialog.showModal();close.focus();
  });
  close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener("close",()=>figureLink.focus());
  if(matchMedia("(max-width:740px)").matches&&!location.hash.includes("abstract"))get("paper-abstract").open=false;
  const originalAlt=small.alt;
  function setLanguage(){
    const zh=language==="zh";
    document.documentElement.lang=zh?"zh-CN":"en";
    for(const item of document.querySelectorAll("[data-zh]")){
      if(!item.hasAttribute("data-en"))item.dataset.en=item.textContent;
      item.textContent=zh?item.dataset.zh:item.dataset.en;
    }
    small.alt=zh?small.dataset.zhAlt:originalAlt;
    if(large.hasAttribute("src"))large.alt=small.alt;
    figureLink.setAttribute("aria-label",local("Enlarge the architecture diagram","放大系统架构图"));
    close.setAttribute("aria-label",local("Close figure","关闭大图"));
    document.querySelector("nav").setAttribute("aria-label",local("Sections","实验导航"));
    for(const [a,v] of registry){
      a.setAttribute("aria-label",zh?a.dataset.zhLabel:a.dataset.enLabel);
      sync(v);
    }
    const u=new URL(location.href);u.searchParams.set("lang",zh?"en":"zh");
    localeLink.href=u.href;localeLink.textContent=zh?"English":"中文";
  }
  localeLink.addEventListener("click",event=>{
    event.preventDefault();
    try{history.replaceState(null,"",localeLink.href);}catch(_){}
    language=language==="en"?"zh":"en";setLanguage();
  });
  setLanguage();
})();
