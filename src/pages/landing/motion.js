export function initMotion(container, life) {
  const root=container;
  const stage=container.querySelector('.stage');
  if(!stage || !Element.prototype.animate)return;
  container.classList.add('clarity-motion');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const pointer=matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  const compact=matchMedia('(max-width: 760px)');
  const introAnimations=new Set();
  const ambientAnimations=new Set();
  const transientAnimations=new Set();
  const enabled=()=>!reduced.matches && root.dataset.motion!=='off';
  const plane=document.createElement('div');
  plane.className='motion-plane';
  const moving=[...stage.children].filter(el=>!el.matches('.swatches,.caption'));
  moving.forEach(el=>plane.append(el));
  stage.prepend(plane);
  for(const className of ['orbit-spark','orbit-spark secondary']){
    const dot=document.createElement('i');dot.className=className;dot.setAttribute('aria-hidden','true');plane.append(dot);
  }
  const heroCopy=container.querySelector('.hero-left') || container.querySelector('.hero>.reveal');
  heroCopy?.classList.remove('reveal');stage.classList.remove('reveal');
  const title=container.querySelector('.hero h1');
  if (title) {
    title.innerHTML='<span class="hero-line"><span>Hiểu từng máy.</span></span><span class="hero-line"><span class="gradient-text">Bứt phá doanh số.</span></span>';
  }
  stage.querySelectorAll('.screen').forEach(screen=>{
    const glint=document.createElement('span');glint.className='device-glint';glint.setAttribute('aria-hidden','true');screen.append(glint);
  });
  const toggle=container.querySelector('#toggle-motion');
  function clear(set){set.forEach(a=>a.cancel());set.clear();}
  function animate(el,frames,options,set=introAnimations){
    if(!el || !enabled())return;
    const animation=el.animate(frames,{duration:850,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards',...options});
    set.add(animation);
    animation.onfinish=()=>{set.delete(animation);animation.cancel();};
    return animation;
  }
  function playIntro(){
    clear(introAnimations);
    if(!enabled() || !heroCopy)return;
    const eyebrow=heroCopy.querySelector('.eyebrow-pill') || heroCopy.querySelector('.eyebrow');
    if(eyebrow) animate(eyebrow,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:650});
    if(title) title.querySelectorAll('.hero-line>span').forEach((line,i)=>animate(line,[{opacity:0,transform:'translateY(105%)'},{opacity:1,transform:'translateY(0)'}],{delay:100+i*150,duration:1050}));
    ['.intro','.actions','.hero-foot-features','.hero-foot'].forEach((selector,i)=>{
      const el=heroCopy.querySelector(selector);
      if(el) animate(el,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{delay:320+i*120,duration:850});
    });
    for(const [selector,x,y,delay] of [['.rear',-28,38,100],['.front',24,50,280]]){
      const device=stage.querySelector(selector);if(!device)continue;const base=getComputedStyle(device).transform;
      animate(device,[{opacity:0,transform:`translate(${x}px,${y}px) rotate(${x/3}deg) ${base}`},{opacity:1,transform:base}],{duration:1400,delay});
    }
    stage.querySelectorAll('.floating-tag').forEach((tag,i)=>animate(tag,[{opacity:0,transform:'translateY(24px) scale(.92)'},{opacity:1,transform:'none'}],{duration:900,delay:750+i*170}));
    const swatches=stage.querySelector('.swatches');
    if(swatches) animate(swatches,[{opacity:0},{opacity:1}],{duration:650,delay:950});
  }
  function startAmbient(){
    clear(ambientAnimations);
    if(!enabled() || document.hidden)return;
    const distance=compact.matches?7:14;
    for(const [selector,phase,duration] of [['.front',0,6200],['.rear',-2400,7400],['.tag-one',-1000,6500],['.tag-two',-3300,8100],['.tag-three',-2000,7000]]){
      const el=stage.querySelector(selector);
      if(!el)continue;
      const animation=el.animate([{translate:'0 0'},{translate:`0 -${selector.includes('tag')?distance/2:distance}px`},{translate:'0 0'}],{duration,delay:phase,iterations:Infinity,easing:'ease-in-out'});
      ambientAnimations.add(animation);
    }
  }
  function sync(){
    const active=enabled();
    toggle.setAttribute('aria-pressed',String(active));
    toggle.textContent=reduced.matches?'Giảm chuyển động':active?'Ⅱ Tắt chuyển động':'▷ Bật chuyển động';
    toggle.disabled=reduced.matches;
    if(!active){
      clear(introAnimations);clear(ambientAnimations);clear(transientAnimations);
      container.querySelectorAll('.color-fade').forEach(el=>el.remove());
      resetPointer();plane.style.setProperty('--scroll-y','0px');
      container.querySelector('.experience-visual')?.style.setProperty('--experience-y','0px');
    }else{startAmbient();scheduleScroll();}
  }
  life.on(toggle,'click',()=>{
    root.dataset.motion=enabled()?'off':'on';
  });
  life.observe(new MutationObserver(sync)).observe(root,{attributes:true,attributeFilter:['data-motion']});
  life.on(reduced,'change',sync);
  life.on(compact,'change',()=>{clear(introAnimations);sync();});
  let pointerFrame=0;let pointerX=0;let pointerY=0;
  function resetPointer(){cancelAnimationFrame(pointerFrame);pointerFrame=0;plane.style.setProperty('--tilt-x','0deg');plane.style.setProperty('--tilt-y','0deg');}
  life.on(stage,'pointermove',event=>{
    if(!enabled() || !pointer.matches)return;
    const rect=stage.getBoundingClientRect();
    pointerX=((event.clientX-rect.left)/rect.width-.5)*8;
    pointerY=((event.clientY-rect.top)/rect.height-.5)*-6;
    if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{plane.style.setProperty('--tilt-x',pointerY.toFixed(2)+'deg');plane.style.setProperty('--tilt-y',pointerX.toFixed(2)+'deg');pointerFrame=0;});
  },{passive:true});
  life.on(stage,'pointerleave',resetPointer);
  life.on(pointer,'change',resetPointer);
  let scrollFrame=0;
  const experience=container.querySelector('.experience-visual');
  function updateScroll(){
    scrollFrame=0;if(!enabled())return;
    const rect=stage.getBoundingClientRect();
    if(rect.bottom>0 && rect.top<innerHeight){const amount=Math.max(0,Math.min(1,-rect.top/rect.height));plane.style.setProperty('--scroll-y',(-amount*(compact.matches?12:32)).toFixed(1)+'px');}
    if(!experience)return;
    const e=experience.getBoundingClientRect();
    if(e.bottom>0 && e.top<innerHeight){const progress=Math.max(0,Math.min(1,(innerHeight-e.top)/(innerHeight+e.height)));experience.style.setProperty('--experience-y',(24-progress*55).toFixed(1)+'px');experience.style.setProperty('--experience-angle',(4-progress*8).toFixed(1)+'deg');}
  }
  function scheduleScroll(){if(!scrollFrame && enabled())scrollFrame=requestAnimationFrame(updateScroll);}
  life.on(window,'scroll',scheduleScroll,{passive:true});
  life.on(window,'resize',scheduleScroll,{passive:true});
  life.on(document,'visibilitychange',()=>{
    if(document.hidden){ambientAnimations.forEach(a=>a.pause());}else if(enabled()){ambientAnimations.forEach(a=>a.play());scheduleScroll();}
  });
  const visibilityObserver=life.observe(new IntersectionObserver(entries=>{
    if(!enabled() || document.hidden)return;
    const visible=entries[0].isIntersecting;ambientAnimations.forEach(a=>visible?a.play():a.pause());
    plane.style.setProperty('animation-play-state',visible?'running':'paused');
    plane.querySelectorAll('.orbit-spark,.device-glint').forEach(el=>el.style.animationPlayState=visible?'running':'paused');
  }));visibilityObserver.observe(stage);
  stage.querySelectorAll('.swatch').forEach(button=>{
    let previous;
    life.on(button,'click',()=>{previous=getComputedStyle(stage.querySelector('.rear')).backgroundImage;},true);
    life.on(button,'click',()=>{
      if(!enabled())return;
      const rear=stage.querySelector('.rear');rear.querySelectorAll('.color-fade').forEach(el=>el.remove());
      const wash=document.createElement('span');wash.className='color-fade';wash.style.backgroundImage=previous;rear.append(wash);
      const animation=animate(wash,[{opacity:1},{opacity:0}],{duration:550,easing:'ease-out'},transientAnimations);
      if(animation)animation.onfinish=()=>{transientAnimations.delete(animation);wash.remove();};
    });
  });
  container.querySelectorAll('details').forEach(details=>life.on(details,'toggle',()=>{
    if(details.open)animate(details.querySelector('p'),[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],{duration:300},transientAnimations);
  }));
  life.add(()=>{clear(introAnimations);clear(ambientAnimations);clear(transientAnimations);cancelAnimationFrame(pointerFrame);cancelAnimationFrame(scrollFrame);});
  sync();
  document.fonts.ready.then(()=>{if(!life.disposed && enabled())playIntro();});
}
