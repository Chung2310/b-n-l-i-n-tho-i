/** Short, local feedback; never changes navigation or sends requests. */
export function initInteractions(container, life) {
  if (!Element.prototype.animate) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => !life.disposed && !reduced.matches && container.dataset.motion !== 'off';
  const running = new Map();
  function play(element, frames, duration = 320) {
    if (!element || !enabled()) return;
    running.get(element)?.cancel();
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
    running.set(element, animation);
    animation.onfinish = () => { animation.cancel(); running.delete(element); };
  }
  function clear() {
    running.forEach(animation => animation.cancel());
    running.clear();
    container.querySelectorAll('.landing-click-wave').forEach(wave => wave.remove());
  }
  life.add(clear);
  life.on(reduced, 'change', () => { if (!enabled()) clear(); });
  life.observe(new MutationObserver(() => { if (!enabled()) clear(); }))
    .observe(container, { attributes: true, attributeFilter: ['data-motion'] });

  const clickable = '.btn, .contact-pill, .showcase-tab-btn, .swatch, [data-finish], [data-view], .menu-toggle, .phone-drag-tools button';
  container.querySelectorAll(clickable).forEach(element => element.classList.add('landing-feedback'));
  life.on(container, 'click', event => {
    const button = event.target.closest(clickable);
    if (!button || button.disabled || !enabled()) return;
    play(button, [{ scale: '.96' }, { scale: '1.025', offset: .65 }, { scale: '1' }]);
    if (button.matches('.swatch, [data-finish]')) {
      const label = button.closest('.swatches, .phone-spin-colors')?.querySelector('.swatch-label, #phone-finish');
      play(label, [{ opacity: .3, translate: '0 5px' }, { opacity: 1, translate: '0 0' }]);
    } else {
      button.querySelectorAll('.landing-click-wave').forEach(wave => {
        running.get(wave)?.cancel(); running.delete(wave); wave.remove();
      });
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const wave = document.createElement('span');
      wave.className = 'landing-click-wave';
      wave.setAttribute('aria-hidden', 'true');
      const x = event.detail ? event.clientX - rect.left : rect.width / 2;
      const y = event.detail ? event.clientY - rect.top : rect.height / 2;
      Object.assign(wave.style, { width: `${size}px`, height: `${size}px`, left: `${x-size/2}px`, top: `${y-size/2}px` });
      button.append(wave);
      play(wave, [{ transform: 'scale(0)', opacity: .28 }, { transform: 'scale(1)', opacity: 0 }], 480);
      running.get(wave).onfinish = () => { running.get(wave)?.cancel(); running.delete(wave); wave.remove(); };
    }
    if (button.matches('.showcase-tab-btn')) {
      const panel = container.querySelector('.showcase-panel.active');
      play(panel, [{ opacity: .25, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], 380);
    }
    if (button.matches('.menu-toggle') && button.getAttribute('aria-expanded') === 'true') {
      play(container.querySelector('.navlinks'), [{ opacity: 0, translate: '0 -8px' }, { opacity: 1, translate: '0 0' }], 220);
    }
  });
}
