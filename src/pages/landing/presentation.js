export function initPresentation(container, life) {
  const iconPaths = {
    phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
    scan:'<path d="M3 8V4a1 1 0 0 1 1-1h4m8 0h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M3 12h18M8 8v8m4-8v8m4-8v8"/>',
    shield:'<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5zM8 12l3 3 5-6"/>',
    bag:'<path d="M5 7h14l1 14H4zM8 8V6a4 4 0 0 1 8 0v2"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    check:'<polyline points="20 6 9 17 4 12"/>',
    box:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    tool:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  };

  function renderIcons(root) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      el.classList.add('icon');
      el.setAttribute('aria-hidden','true');
      el.innerHTML = '<svg viewBox="0 0 24 24">'+(iconPaths[el.dataset.icon] || iconPaths.phone)+'</svg>';
    });
  }

  renderIcons(container);

  container.querySelectorAll('[data-device]').forEach(el => {
    el.setAttribute('aria-hidden','true');
    el.classList.add('phone');
    if(el.dataset.device === 'back') {
      el.classList.add('back');
      el.innerHTML = '<div class="camera-bump"><i class="lens"></i><i class="lens"></i><i class="lens"></i><i class="flash"></i></div><span class="back-brand">iGen</span>';
    } else {
      el.innerHTML = `
        <div class="screen">
          <div class="island"></div>
          <div class="phone-status"><span>09:41</span><span>5G ▮▮▮</span></div>
          <div class="phone-app-mock">
            <div class="app-mock-header">
              <span class="app-mock-brand">iGen POS</span>
              <span class="app-mock-status">● Live</span>
            </div>
            <div class="app-mock-card">
              <div class="app-mock-scanner-row">
                <span class="app-mock-scan-pill"><i data-icon="scan"></i> QUÉT IMEI</span>
                <span class="app-mock-badge green">Khớp 100%</span>
              </div>
              <div class="app-mock-imei">354890 • 11 • 8274921</div>
              <div class="app-mock-title">iPhone 16 Pro Max 256GB</div>
              <div class="app-mock-meta">Titan Sa Mạc • VN/A • Pin 100%</div>
              <div class="app-mock-price-row">
                <span class="app-mock-price">31.990.000₫</span>
                <span class="app-mock-warranty">BH 12T Care+</span>
              </div>
            </div>
            <div class="app-mock-sepay-alert">
              <i data-icon="zap"></i>
              <div>
                <strong>SePay QR Tự Động Khớp</strong>
                <span>Khách đã chuyển +31.990.000₫</span>
              </div>
            </div>
            <div class="app-mock-bottom-bar">
              <span class="active"><i data-icon="phone"></i>POS</span>
              <span><i data-icon="box"></i>Kho</span>
              <span><i data-icon="tool"></i>Sửa chữa</span>
            </div>
          </div>
          <div class="phone-home"></div>
        </div>`;
      renderIcons(el);
    }
  });

  const toggle = container.querySelector('.menu-toggle');
  const nav = container.querySelector('.navlinks');
  function closeMenu(){nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');if(toggle) toggle.textContent='☰';}
  life.on(toggle,'click',()=>{
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'×':'☰';
  });
  nav?.querySelectorAll('a').forEach(a=>life.on(a,'click',closeMenu));
  life.on(document,'keydown',e=>{if(e.key==='Escape')closeMenu();});

  container.querySelectorAll('.swatch').forEach(button=>life.on(button,'click',()=>{
    const group=button.closest('.swatches');
    group.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    container.querySelectorAll('.phone.back').forEach(p=>p.dataset.color=button.dataset.color);
    group.querySelector('.swatch-label').textContent=button.getAttribute('aria-label');
  }));

  // App Showcase tab switching
  container.querySelectorAll('.showcase-tab-btn').forEach(btn => {
    life.on(btn, 'click', () => {
      const targetTab = btn.dataset.targetTab;
      container.querySelectorAll('.showcase-tab-btn').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      container.querySelectorAll('.showcase-panel').forEach(panel => {
        const match = panel.dataset.tab === targetTab;
        panel.classList.toggle('active', match);
        panel.setAttribute('aria-hidden', String(!match));
      });
    });
  });

  // Quick Consultation Form handler
  const leadForm = container.querySelector('#lead-form');
  if (leadForm) {
    life.on(leadForm, 'submit', (e) => {
      e.preventDefault();
      const input = leadForm.querySelector('input[name="phone"]');
      const feedback = leadForm.querySelector('.lead-form-feedback');
      const phoneVal = input?.value?.trim();
      if (!phoneVal || phoneVal.length < 9) {
        if (feedback) feedback.textContent = 'Vui lòng nhập số điện thoại hoặc Zalo hợp lệ.';
        return;
      }
      if (feedback) {
        feedback.innerHTML = '✓ Đã nhận thông tin! Chuyên viên iGen sẽ kết nối Zalo với bạn trong 5 phút.';
        feedback.style.color = '#10b981';
      }
      if (input) input.value = '';
    });
  }

  // Counter animation for stats ribbon
  const statObserver = life.observe(new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const numEl = entry.target.querySelector('.stat-number');
        if (numEl && !numEl.dataset.animated) {
          numEl.dataset.animated = 'true';
          const target = parseInt(numEl.dataset.countTarget || '0', 10);
          const suffix = numEl.dataset.countSuffix || '';
          if (target === 0) {
            numEl.textContent = '0' + suffix;
            return;
          }
          const duration = 1600;
          const startTime = performance.now();
          let counterFrame = 0;
          life.add(() => cancelAnimationFrame(counterFrame));
          function tick(now) {
            if (life.disposed) return;
            const elapsed = now - startTime;
            const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || container.dataset.motion === 'off';
            const progress = reduce ? 1 : Math.min(1, elapsed / duration);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * ease);
            numEl.textContent = (target >= 10000 ? current.toLocaleString('vi-VN') : String(current)) + suffix;
            if (progress < 1) counterFrame = requestAnimationFrame(tick);
          }
          counterFrame = requestAnimationFrame(tick);
        }
      }
    });
  }, { threshold: 0.15 }));
  container.querySelectorAll('.stat-card').forEach(c => statObserver.observe(c));

  // Mouse Spotlight Effect for Bento Cards
  container.querySelectorAll('.bento-card').forEach(card => {
    life.on(card, 'mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });

  const observer=life.observe(new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08}));
  container.classList.add('motion-ready');
  container.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

  life.on(container,'click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(!link)return;
    const id=link.getAttribute('href').slice(1);
    const destination=id?container.querySelector('#'+CSS.escape(id)):container;
    if(!destination)return;
    event.preventDefault();
    destination.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches||container.dataset.motion==='off'?'instant':'smooth',block:'start'});
    if(id){history.replaceState(null,'','#'+id);destination.setAttribute('tabindex','-1');destination.focus({preventScroll:true});}
  });
}
