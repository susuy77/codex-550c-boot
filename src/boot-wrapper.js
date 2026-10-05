const host = document.getElementById('codex-550c-boot');
if (!host) return;
const initialRoute = new URLSearchParams(window.location.search).get('initialRoute') || '';
if (initialRoute === '/avatar-overlay' || initialRoute.startsWith('/avatar-overlay/')) { host.remove(); return; }
const cancelled = Symbol('cancelled');
let show, done = false;
const remove = () => host.remove();
function finish() {
  if (done) return;
  done = true;
  console.info('CODEX_550C:END');
  clearTimeout(watchdog);
  document.removeEventListener('keydown', keydown, true);
  host.removeEventListener('click', click);
  if (show) show.cancel();
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  setTimeout(remove, 400);
}
function keydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopImmediatePropagation(); finish();
  }
}
function click(event) {
  event.preventDefault(); event.stopPropagation(); finish();
}
const watchdog = setTimeout(finish, 28000);
document.addEventListener('keydown', keydown, true);
host.addEventListener('click', click);
try {
  const stage = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = CSS_550C + '\n:host{display:block;position:fixed;inset:0;z-index:2147483647;-webkit-app-region:no-drag;} #final{max-width:95vw;padding:35px 4vw;white-space:normal;}';
  stage.appendChild(style);
  const content = document.createElement('div');
  content.innerHTML = BOOT_MARKUP + APP_MARKUP;
  stage.appendChild(content);
  const text = stage.querySelector('#bootText');
  if (text) text.innerHTML = 'CODEX / 550C BOOT<span class="cursor"></span>';
  const brand = stage.querySelector('#hud-top .brand');
  if (brand) brand.textContent = 'CODEX / 550C';
  show = createShow(stage, {mode:'full', cancelled});
  console.info('CODEX_550C:START');
  requestAnimationFrame(() => show.start().then(finish).catch(error => {
    if (error !== cancelled) console.warn('550C boot animation stopped', error);
    finish();
  }));
} catch (error) { console.warn('550C boot animation unavailable', error); finish(); }

