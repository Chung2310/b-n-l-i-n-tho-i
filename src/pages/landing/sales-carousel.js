/** Carousel timers and listeners belong to the landing-page lifetime. */
export function initSalesCarousel(container, life) {
  const carousel = container.querySelector('.sales-carousel');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('.sales-slide')];
  let current = 0, timer, visible = false;
  const stop = () => clearTimeout(timer);
  function schedule() {
    stop();
    if (life.disposed || !visible || document.hidden) return;
    timer = setTimeout(() => { show(current + 1); schedule(); }, 5000);
  }
  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const offset = (i - current + slides.length) % slides.length;
      slide.dataset.position = offset === 0 ? 'active' : offset === 1 ? 'next' : 'previous';
      slide.setAttribute('aria-hidden', String(i !== current));
    });
  }
  life.on(carousel, 'click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-carousel-prev')) show(current - 1);
    if (button.hasAttribute('data-carousel-next')) show(current + 1);
    schedule();
  });
  life.on(carousel, 'keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
    schedule();
  });
  life.on(document, 'visibilitychange', schedule);
  life.observe(new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; schedule();
  }, { threshold: 0.25 })).observe(carousel);
  life.add(stop);
  show(0);
}
