import * as THREE from './vendor/three/three.module.js';

// Procedural iPhone 18 Pro visual reconstruction from Apple's product references.
// Approximate materials and geometry; not an official Apple CAD asset.
export function initPhoneStory(section, life){
  const root=section.closest(".igen-landing");
  const mount=section.querySelector('.phone-spin-mount');
  const pin=section.querySelector('.phone-story-pin');
  const panels=[...section.querySelectorAll('.phone-story-panel')];
  const steps=[...section.querySelectorAll('[data-view]')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const viewNames=['Góc chính diện','Góc nghiêng & cạnh viền','Mặt lưng & cụm camera'];
  const finishes={glacier:0x9eb5d0,silver:0xd9dcd9,black:0x242629,burgundy:0x542633};
  let renderer,scene,camera,phone,bodyMaterial,backMaterial,bumpMaterial,screenTexture;
  let frame=0,visible=false,disposed=false,progress=0,staticProgress=0,activeStep=-1,finish='glacier';
  let manual=false,manualYaw=0,manualPitch=0,manualRoll=0,drag=null;
  const coarse=matchMedia('(pointer: coarse)');
  const resetButton=section.querySelector('#phone-reset-view');
  const touchButton=section.querySelector('#phone-touch-rotate');
  const moving=()=>!reduced.matches && root.dataset.motion!=='off';
  const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
  const deg=THREE.MathUtils.degToRad;
  let resources=[];
  function remember(resource){resources.push(resource);return resource;}
  function roundedShape(w,h,r){
    const x=-w/2,y=-h/2,s=new THREE.Shape();
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
    s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
  }
  function solid(w,h,r,depth,material,z=0,bevel=.015){
    const geometry=remember(new THREE.ExtrudeGeometry(roundedShape(w,h,r),{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:12,steps:1}));
    geometry.translate(0,0,-depth/2);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;return mesh;
  }
  function surface(w,h,r,material,z=0){
    const geometry=remember(new THREE.ShapeGeometry(roundedShape(w,h,r),24));
    const positions=geometry.attributes.position;
    const uv=geometry.attributes.uv;
    for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)+w/2)/w,(positions.getY(i)+h/2)/h);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;return mesh;
  }
  function material(options){return remember(new THREE.MeshStandardMaterial(options));}
  function disk(parent,x,y,z,r,mat){const mesh=new THREE.Mesh(remember(new THREE.CircleGeometry(r,48)),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  function screenMap(){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1536;
    const c=canvas.getContext('2d');
    
    // Nền tối công nghệ cao (Deep Dark Tech Glass)
    const bgGrad=c.createLinearGradient(0,0,768,1536);
    bgGrad.addColorStop(0,'#0a1420');
    bgGrad.addColorStop(0.4,'#0e1f32');
    bgGrad.addColorStop(1,'#07101a');
    c.fillStyle=bgGrad;c.fillRect(0,0,768,1536);

    // Dải hào quang ambient ở giữa màn hình
    const aura=c.createRadialGradient(384,600,50,384,600,450);
    aura.addColorStop(0,'#1679b240');
    aura.addColorStop(1,'#1679b200');
    c.fillStyle=aura;c.fillRect(0,200,768,800);

    // Status Bar
    c.fillStyle='#ffffff';
    c.font='bold 28px sans-serif';
    c.fillText('09:41',65,68);
    c.font='22px sans-serif';
    c.fillText('5G  ▮▮▮',640,68);

    // App Header (y: 110-180)
    c.fillStyle='#ffffff';
    c.font='bold 34px sans-serif';
    c.fillText('iGen Cloud POS',65,150);

    // Live Badge
    c.fillStyle='#10b98125';
    c.beginPath();c.roundRect(580,118,125,44,22);c.fill();
    c.strokeStyle='#10b98180';c.lineWidth=2;c.stroke();
    c.fillStyle='#10b981';c.beginPath();c.arc(606,140,6,0,Math.PI*2);c.fill();
    c.font='bold 20px sans-serif';
    c.fillText('ONLINE',624,147);

    // Card 1: Khung Camera Quét IMEI & Barcode (y: 200 - 660)
    const cardGrad=c.createLinearGradient(0,200,0,660);
    cardGrad.addColorStop(0,'#ffffff12');cardGrad.addColorStop(1,'#ffffff05');
    c.fillStyle=cardGrad;
    c.beginPath();c.roundRect(55,200,658,460,32);c.fill();
    c.strokeStyle='#ffffff20';c.lineWidth=2;c.stroke();

    // Viewfinder Scanner Box
    c.fillStyle='#00000060';
    c.beginPath();c.roundRect(95,240,578,250,20);c.fill();
    c.strokeStyle='#087bbd60';c.lineWidth=2;c.stroke();

    // 4 góc Scanner phát sáng Cyan
    c.strokeStyle='#38bdf8';c.lineWidth=6;
    // top-left
    c.beginPath();c.moveTo(125,290);c.lineTo(125,270);c.lineTo(145,270);c.stroke();
    // top-right
    c.beginPath();c.moveTo(625,290);c.lineTo(625,270);c.lineTo(605,270);c.stroke();
    // bottom-left
    c.beginPath();c.moveTo(125,440);c.lineTo(125,460);c.lineTo(145,460);c.stroke();
    // bottom-right
    c.beginPath();c.moveTo(625,440);c.lineTo(625,460);c.lineTo(605,460);c.stroke();

    // Tia Laser quét màu đỏ/xanh
    const laserGrad=c.createLinearGradient(125,365,625,365);
    laserGrad.addColorStop(0,'#38bdf800');laserGrad.addColorStop(0.5,'#38bdf8');laserGrad.addColorStop(1,'#38bdf800');
    c.strokeStyle=laserGrad;c.lineWidth=4;
    c.beginPath();c.moveTo(125,365);c.lineTo(625,365);c.stroke();

    // Nhãn Barcode bên trong
    c.fillStyle='#38bdf8';
    c.font='bold 22px sans-serif';
    c.fillText('ĐANG QUÉT MÃ VẠCH IMEI...',240,415);

    // Thông tin IMEI đã nhận diện
    c.fillStyle='#94a3b8';
    c.font='20px monospace';
    c.fillText('SERIAL / IMEI ĐÃ KHỚP:',95,540);
    c.fillStyle='#f8fafc';
    c.font='bold 30px monospace';
    c.fillText('354890 • 11 • 8274921',95,585);
    c.fillStyle='#10b981';
    c.font='bold 20px sans-serif';
    c.fillText('✓ Hợp lệ trong kho',520,585);

    // Card 2: Chi tiết Máy & Thanh toán SePay (y: 690 - 1180)
    c.fillStyle=cardGrad;
    c.beginPath();c.roundRect(55,690,658,490,32);c.fill();
    c.strokeStyle='#ffffff20';c.lineWidth=2;c.stroke();

    c.fillStyle='#ffffff';
    c.font='bold 34px sans-serif';
    c.fillText('iPhone 16 Pro Max 256GB',95,760);

    c.fillStyle='#94a3b8';
    c.font='24px sans-serif';
    c.fillText('VN/A • Titan Sa Mạc • Pin 100% • Mới 100%',95,805);

    // Giá bán
    c.fillStyle='#38bdf8';
    c.font='bold 44px sans-serif';
    c.fillText('31.990.000 ₫',95,880);

    // Tag Bảo hành
    c.fillStyle='#3b82f625';
    c.beginPath();c.roundRect(500,840,175,50,14);c.fill();
    c.strokeStyle='#3b82f680';c.lineWidth=1.5;c.stroke();
    c.fillStyle='#93c5fd';
    c.font='bold 20px sans-serif';
    c.fillText('BH 12T Care+',522,872);

    // Vạch ngăn cách mờ
    c.strokeStyle='#ffffff15';c.lineWidth=1;
    c.beginPath();c.moveTo(95,920);c.lineTo(673,920);c.stroke();

    // Box Thanh toán SePay tự động
    c.fillStyle='#10b98118';
    c.beginPath();c.roundRect(95,950,578,190,20);c.fill();
    c.strokeStyle='#10b98150';c.lineWidth=1.5;c.stroke();

    c.fillStyle='#10b981';
    c.font='bold 26px sans-serif';
    c.fillText('⚡ SePay VietQR Tự Động Khớp',135,1005);

    c.fillStyle='#e2e8f0';
    c.font='22px sans-serif';
    c.fillText('Ngân hàng: MB Bank • Số tiền: +31.990.000 ₫',135,1055);
    c.fillStyle='#94a3b8';
    c.font='20px sans-serif';
    c.fillText('Nội dung: DH-98214 • Đã in hóa đơn bán hàng',135,1100);

    // Bottom Navigation Bar (y: 1360 - 1460)
    c.fillStyle='#050c14dd';
    c.beginPath();c.roundRect(55,1360,658,95,28);c.fill();
    c.strokeStyle='#ffffff18';c.lineWidth=1.5;c.stroke();

    c.fillStyle='#38bdf8';
    c.font='bold 22px sans-serif';
    c.fillText('● POS Bán Hàng',110,1418);
    c.fillStyle='#94a3b8';
    c.fillText('Kho IMEI',335,1418);
    c.fillText('Sửa Chữa',485,1418);
    c.fillText('Báo Cáo',615,1418);

    // Home indicator
    c.fillStyle='#ffffff80';
    c.beginPath();c.roundRect(258,1490,250,11,6);c.fill();

    const texture=remember(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  function build(){
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.domElement.setAttribute('aria-hidden','true');mount.append(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.1,60);camera.position.set(0,.05,11);camera.lookAt(0,0,0);
    const envCanvas=document.createElement('canvas');envCanvas.width=1024;envCanvas.height=512;
    const e=envCanvas.getContext('2d');e.fillStyle='#aabccc';e.fillRect(0,0,1024,512);
    const glow=e.createLinearGradient(0,0,0,512);glow.addColorStop(0,'#f8fcff');glow.addColorStop(.5,'#899bab');glow.addColorStop(1,'#dae9f1');e.fillStyle=glow;e.fillRect(0,0,1024,512);
    e.fillStyle='#ffffff';e.fillRect(80,65,140,320);e.fillRect(500,20,240,135);e.fillRect(810,50,80,300);
    const envTexture=remember(new THREE.CanvasTexture(envCanvas));envTexture.mapping=THREE.EquirectangularReflectionMapping;envTexture.colorSpace=THREE.SRGBColorSpace;
    const pmrem=new THREE.PMREMGenerator(renderer);const env=remember(pmrem.fromEquirectangular(envTexture));scene.environment=env.texture;scene.environmentIntensity=.7;pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xf4fbff,0x7690a3,1.4));
    for(const [color,intensity,x,y,z] of [[0xffffff,2.3,4,5,6],[0xc5eaff,1.3,-5,1,4],[0xffffff,2,-3,4,-5]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);}
    phone=new THREE.Group();scene.add(phone);
    bodyMaterial=material({color:finishes[finish],metalness:.82,roughness:.3});
    backMaterial=remember(new THREE.MeshPhysicalMaterial({color:finishes[finish],metalness:.3,roughness:.32,clearcoat:.7,clearcoatRoughness:.22}));
    bumpMaterial=material({color:finishes[finish],metalness:.48,roughness:.26});
    const black=material({color:0x09131c,roughness:.24,metalness:.25});
    const lensBlack=material({color:0x060e17,roughness:.12,metalness:.32});
    const rim=material({color:0x567487,metalness:.95,roughness:.2});
    const iris=material({color:0x132f59,metalness:.65,roughness:.08});
    const white=material({color:0xf3faff,roughness:.4});
    phone.add(solid(2.35,4.94,.36,.288,bodyMaterial,0,.025));
    phone.add(solid(2.28,4.87,.3,.035,black,.142,.006));
    screenTexture=screenMap();
    phone.add(surface(2.16,4.73,.25,remember(new THREE.MeshBasicMaterial({map:screenTexture})),.17));
    const island=surface(.48,.155,.0775,black,.184);island.position.y=2.16;phone.add(island);
    disk(phone,.16,2.16,.187,.023,iris);
    const back=new THREE.Group();back.rotation.y=Math.PI;back.position.z=-.17;phone.add(back);
    back.add(surface(2.27,4.86,.31,backMaterial,.004));
    const glass=surface(2.13,3.12,.28,backMaterial,.014);glass.position.y=-.73;back.add(glass);
    const bump=solid(2.19,1.42,.28,.12,bumpMaterial,.075,.022);bump.position.set(0,1.61,.075);back.add(bump);
    for(const [x,y] of [[-.72,1.97],[-.72,1.28],[-.08,1.62]]){
      const barrel=new THREE.Mesh(remember(new THREE.CylinderGeometry(.226,.235,.12,48)),rim);barrel.rotation.x=Math.PI/2;barrel.position.set(x,y,.17);back.add(barrel);
      disk(back,x,y,.235,.205,lensBlack);disk(back,x,y,.237,.126,iris);disk(back,x,y,.239,.064,lensBlack);
      const glassRing=new THREE.Mesh(remember(new THREE.TorusGeometry(.177,.009,8,48)),rim);glassRing.position.set(x,y,.239);back.add(glassRing);
      disk(back,x-.036,y+.044,.241,.024,remember(new THREE.MeshBasicMaterial({color:0x80b8f1,transparent:true,opacity:.48})));
    }
    disk(back,.76,1.94,.16,.085,white);disk(back,.76,1.27,.16,.08,lensBlack);disk(back,.78,1.59,.16,.018,lensBlack);
    const logoCanvas=document.createElement('canvas');logoCanvas.width=256;logoCanvas.height=320;const l=logoCanvas.getContext('2d');l.fillStyle='#ffffff';
    l.beginPath();l.moveTo(128,95);l.bezierCurveTo(83,63,28,102,40,170);l.bezierCurveTo(45,213,78,273,103,258);l.bezierCurveTo(132,243,137,250,159,259);l.bezierCurveTo(183,268,210,226,219,199);l.bezierCurveTo(170,178,174,128,215,108);l.bezierCurveTo(186,75,157,77,128,95);l.fill();
    l.beginPath();l.moveTo(131,80);l.bezierCurveTo(126,46,151,20,183,16);l.bezierCurveTo(186,47,162,76,131,80);l.fill();
    const logoTexture=remember(new THREE.CanvasTexture(logoCanvas));logoTexture.colorSpace=THREE.SRGBColorSpace;
    const logo=new THREE.Mesh(remember(new THREE.PlaneGeometry(.55,.69)),remember(new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,opacity:.24,depthWrite:false})));logo.position.set(0,-.48,.018);back.add(logo);
    for(const [x,y,h] of [[1.2,.72,.61],[-1.2,1.2,.18],[-1.2,.64,.36],[-1.2,.13,.36]]){const button=new THREE.Mesh(remember(new THREE.BoxGeometry(.045,h,.105)),bodyMaterial);button.position.set(x,y,0);phone.add(button);}
    const antenna=material({color:0xe5f0f7,roughness:.6});
    for(const x of [-1.201,1.201])for(const y of [-1.75,1.8]){const line=new THREE.Mesh(remember(new THREE.BoxGeometry(.008,.028,.21)),antenna);line.position.set(x,y,0);phone.add(line);}
    const port=new THREE.Mesh(remember(new THREE.BoxGeometry(.35,.02,.092)),black);port.position.set(0,-2.497,0);phone.add(port);
    for(let i=0;i<5;i++)for(const sign of [-1,1]){const hole=new THREE.Mesh(remember(new THREE.SphereGeometry(.024,10,8)),black);hole.scale.y=.3;hole.position.set(sign*(.48+i*.09),-2.5,0);phone.add(hole);}
    life.on(renderer.domElement,'webglcontextlost',contextLost,false);
    section.dataset.renderer='webgl';resize();
  }
  function pose(value){
    const keys=[[0,0,0,-4],[.12,-8,-2,-5],[.48,-72,7,-8],[.62,-104,5,-5],[.88,-170,-3,5],[1,-180,0,4]];
    let i=0;while(i<keys.length-2 && value>keys[i+1][0])i++;
    const a=keys[i],b=keys[i+1],t=clamp((value-a[0])/(b[0]-a[0]));
    return {y:THREE.MathUtils.lerp(a[1],b[1],t),x:THREE.MathUtils.lerp(a[2],b[2],t),z:THREE.MathUtils.lerp(a[3],b[3],t)};
  }
  function draw(){
    frame=0;if(disposed || document.hidden)return;
    if(moving() && section.dataset.renderer==='webgl'){
      const rect=section.getBoundingClientRect();progress=clamp(-rect.top/Math.max(1,section.offsetHeight-pin.offsetHeight));
    }else progress=staticProgress;
    const p=manual?{x:manualPitch,y:manualYaw,z:manualRoll}:pose(progress);
    if(phone){phone.rotation.set(deg(p.x),deg(p.y),deg(p.z));phone.position.y=Math.sin(progress*Math.PI)*.06;}
    section.dataset.progress=progress.toFixed(4);section.dataset.angle=Math.abs(p.y).toFixed(1);
    section.dataset.pitch=p.x.toFixed(1);section.dataset.yaw=p.y.toFixed(1);
    section.dataset.control=manual?'manual':'scroll';
    const faceAngle=Math.abs(((p.y+180)%360+360)%360-180);
    section.querySelector('#phone-angle').textContent=manual?`${Math.round(faceAngle)}° / ${Math.round(p.x)}°`:Math.round(Math.abs(p.y))+'°';
    const next=manual?(faceAngle<40?0:faceAngle<135?1:2):(progress<.31?0:progress<.73?1:2);
    if(activeStep!==next){
      activeStep=next;panels.forEach((panel,i)=>{panel.setAttribute('aria-hidden',String(i!==next));panel.inert=i!==next;});
      steps.forEach((button,i)=>{if(i===next)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
      section.querySelector('#phone-step-number').textContent=`0${next+1} / 03`;
    }
    section.querySelector('#phone-view-name').textContent=manual?(p.x>55?'Cạnh dưới · Xoay tự do':p.x< -55?'Cạnh trên · Xoay tự do':'Góc nhìn tự do'):viewNames[next];
    steps.forEach((button,i)=>button.style.setProperty('--step-progress',String(clamp(progress*3-i))));
    mount.setAttribute('aria-label',`Xoay điện thoại 3D màu ${section.querySelector('#phone-finish').textContent.toLowerCase()}, ${viewNames[next].toLowerCase()}`);
    section.querySelector('.phone-spin-shadow').style.setProperty('--shadow-scale',String(.4+.6*Math.abs(Math.cos(deg(p.y)))));
    if(renderer && section.dataset.renderer==='webgl')renderer.render(scene,camera);
  }
  function schedule(){if(!frame && !disposed && !document.hidden)frame=requestAnimationFrame(draw);}
  function resize(){
    if(!renderer || disposed)return;
    const width=mount.clientWidth,height=mount.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    const vFov=deg(32),fitHeight=6.05/(2*Math.tan(vFov/2)),fitWidth=3.5/(2*Math.tan(vFov/2)*camera.aspect);
    camera.position.z=Math.max(fitHeight,fitWidth);camera.updateProjectionMatrix();schedule();
  }
  function syncMotion(){
    if(section.dataset.renderer==='fallback')return;
    if(!moving() && !section.classList.contains('spin-static'))staticProgress=progress;
    section.classList.toggle('spin-static',!moving() || section.dataset.renderer==='fallback');
    updateHint();
    resize();schedule();
  }
  function contextLost(event){event.preventDefault();fallback();}
  function fallback(){
    section.dataset.renderer='fallback';section.classList.add('spin-static');
    section.querySelector('.phone-spin-caption').textContent='Góc nhìn minh họa · Trình duyệt này không hiển thị 3D';
    steps.forEach(button=>button.disabled=true);
    section.querySelectorAll('[data-finish]').forEach(button=>button.disabled=true);
    resetButton.disabled=true;touchButton.disabled=true;mount.tabIndex=-1;endDrag();
    section.querySelector('.phone-spin-hint span').textContent='Bạn có thể tiếp tục xem nội dung bên dưới';
    renderer?.dispose();renderer=null;schedule();
  }
  steps.forEach((button,i)=>life.on(button,'click',()=>{
    resetManual();
    const target=[0,.48,1][i];
    if(!moving()){staticProgress=target;schedule();return;}
    const top=scrollY+section.getBoundingClientRect().top+target*(section.offsetHeight-pin.offsetHeight);
    window.scrollTo({top,behavior:'smooth'});
  }));
  function updateHint(){
    resetButton.disabled=!manual;
    const touchMode=section.classList.contains('is-touch-rotating');
    touchButton.setAttribute('aria-pressed',String(touchMode));
    touchButton.textContent=touchMode?'✓ Xong, tiếp tục cuộn':'✥ Xoay bằng tay';
    section.querySelector('.phone-spin-hint span').textContent=manual?'Đang xoay tự do · Đặt lại để theo cuộn':moving()?'Cuộn để đổi góc · Kéo để xoay tự do':'Chọn góc hoặc kéo để xoay';
    section.querySelector('#phone-drag-help').textContent=touchMode?'Kéo lên / xuống / trái / phải trong khung để xoay.':coarse.matches?'Bấm “Xoay bằng tay” để kéo máy bằng ngón tay.':'Giữ chuột và kéo để xoay 4 hướng · Phím mũi tên cũng dùng được.';
  }
  function beginManual(){
    if(manual)return;
    const p=pose(progress);manualPitch=p.x;manualYaw=p.y;manualRoll=p.z;manual=true;
    updateHint();
  }
  function endDrag(){
    const previous=drag;drag=null;section.classList.remove('is-dragging');
    if(previous && mount.hasPointerCapture(previous.id))mount.releasePointerCapture(previous.id);
  }
  function resetManual(){
    endDrag();manual=false;manualYaw=0;manualPitch=0;manualRoll=0;
    section.classList.remove('is-touch-rotating');updateHint();schedule();
  }
  life.on(resetButton,'click',resetManual);
  life.on(touchButton,'click',()=>{
    endDrag();section.classList.toggle('is-touch-rotating');updateHint();
  });
  life.on(mount,'pointerdown',event=>{
    if(section.dataset.renderer!=='webgl' || !event.isPrimary || drag || (event.pointerType==='mouse' && event.button!==0))return;
    if(event.pointerType==='touch' && !section.classList.contains('is-touch-rotating'))return;
    event.preventDefault();mount.focus({preventScroll:true});
    beginManual();drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    mount.setPointerCapture(event.pointerId);section.classList.add('is-dragging');
  });
  life.on(mount,'pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    event.preventDefault();
    const sensitivity=220/Math.max(250,Math.min(mount.clientWidth,mount.clientHeight));
    manualYaw+=(event.clientX-drag.x)*sensitivity;
    manualPitch=clamp(manualPitch+(event.clientY-drag.y)*sensitivity,-85,85);
    // Keep angles numerically small after full turns, without restricting rotation.
    manualYaw=((manualYaw+180)%360+360)%360-180;
    drag.x=event.clientX;drag.y=event.clientY;schedule();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])life.on(mount,type,event=>{if(drag?.id===event.pointerId)endDrag();});
  life.on(mount,'keydown',event=>{
    if(section.dataset.renderer!=='webgl')return;
    if(event.key==='Home' || event.key==='Escape'){event.preventDefault();resetManual();return;}
    const offset={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[event.key];
    if(!offset)return;event.preventDefault();beginManual();
    manualYaw=((manualYaw+offset[0]+180)%360+360)%360-180;
    manualPitch=clamp(manualPitch+offset[1],-85,85);schedule();
  });
  life.on(window,'blur',endDrag);
  life.on(coarse,'change',()=>{endDrag();updateHint();});
  section.querySelectorAll('[data-finish]').forEach(button=>life.on(button,'click',()=>{
    finish=button.dataset.finish;
    backMaterial?.color.setHex(finishes[finish]);bumpMaterial?.color.setHex(finishes[finish]);
    bodyMaterial?.color.setHex(finishes[finish]);
    if(phone){const old=screenTexture;screenTexture=screenMap();phone.children.find(child=>child.material?.map===old).material.map=screenTexture;old.dispose();resources=resources.filter(resource=>resource!==old);}
    section.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    section.querySelector('#phone-finish').textContent=button.getAttribute('aria-label');schedule();
  }));
  life.on(window,'scroll',()=>{if(visible && moving())schedule();},{passive:true});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();},{rootMargin:'120px'});observer.observe(section);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);
  const motionObserver=new MutationObserver(syncMotion);motionObserver.observe(root,{attributes:true,attributeFilter:['data-motion']});
  life.on(reduced,'change',syncMotion);
  life.on(document,'visibilitychange',()=>{if(!document.hidden && visible)schedule();});
  life.add(()=>{
    disposed=true;endDrag();cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();motionObserver.disconnect();
    renderer?.dispose();resources.forEach(resource=>resource.dispose());
  });
  try{build();syncMotion();document.fonts.ready.then(()=>{
    if(disposed||!phone)return;
    const old=screenTexture;screenTexture=screenMap();phone.children.find(child=>child.material?.map===old).material.map=screenTexture;schedule();
  });}catch(error){console.warn('Phone preview fallback:',error.message);fallback();}
}
