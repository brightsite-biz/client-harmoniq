// Scroll motion. Content is visible without JavaScript; this only enhances it.
// Rules: never hide above-the-fold text, respect reduced motion, fail open (show everything) on any error.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const targets = [...document.querySelectorAll('[data-reveal]')];

async function start() {
  if (reduce || !targets.length) return;
  document.documentElement.classList.add('js-motion');
  const failOpen = setTimeout(() => document.documentElement.classList.remove('js-motion'), 4000);
  try {
    const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
      import('gsap'), import('gsap/ScrollTrigger'), import('lenis'),
    ]);
    gsap.registerPlugin(ScrollTrigger);
    clearTimeout(failOpen);

    if (matchMedia('(pointer: fine)').matches) {
      const lenis = new Lenis({ anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    ScrollTrigger.batch(targets, {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true }),
    });
  } catch {
    clearTimeout(failOpen);
    document.documentElement.classList.remove('js-motion');
  }
}

if (document.readyState === 'complete') start();
else addEventListener('load', start, { once: true });
