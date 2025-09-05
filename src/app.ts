// Types
interface CatItem {
  id: string;
  src: string;
}

// Config
const COUNT = 20;
const RAND_URL = (seed: string) => `https://cataas.com/cat?random=${seed}`;
const SAY_URL = (txt: string, seed: string) =>
  `https://cataas.com/cat/says/${encodeURIComponent(txt)}?fontSize=40&fontColor=white&random=${seed}`;

// State
const state = {
  items: [] as CatItem[],
  index: 0,
  liked: [] as CatItem[],
  disliked: [] as CatItem[],
};

// DOM Elements
const $ = (id: string) => document.getElementById(id);
const deckEl = $("deck") as HTMLDivElement;
const loadingEl = $("loading") as HTMLDivElement;
const errorEl = $("error") as HTMLDivElement;
const doneEl = $("done") as HTMLDivElement;
const summaryEl = $("summary") as HTMLDivElement;
const progressEl = $("progress") as HTMLDivElement;
const counterEl = $("counter")!.firstElementChild as HTMLElement;
const totalEl = $("total") as HTMLElement;
const likeBtn = $("likeBtn") as HTMLButtonElement;
const nopeBtn = $("nopeBtn") as HTMLButtonElement;
const retryBtn = $("retry") as HTMLButtonElement;
const hintEl = $("hint") as HTMLDivElement;

// Utils
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Only use image endpoints to avoid CORS/JSON issues
async function fetchCats(n: number): Promise<CatItem[]> {
  const now = Date.now();
  const items: CatItem[] = Array.from({ length: n }, (_, i) => ({
    id: `rand-${i}`,
    src: RAND_URL(`${now}-${i}`)
  }));

  // Quick preload (tolerate failures)
  await Promise.all(items.map(item => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = item.src;
  })));

  return items;
}

function renderProgress() {
  if (!progressEl) return;
  
  progressEl.innerHTML = '';
  for (let i = 0; i < state.items.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i < state.index ? ' active' : '');
    progressEl.appendChild(dot);
  }
  
  if (counterEl) counterEl.textContent = String(state.index);
  if (totalEl) totalEl.textContent = String(state.items.length);
}

function createCard(item: CatItem, z: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.zIndex = String(z);

  const seed = Date.now() + '-' + Math.random().toString(36).slice(2);
  const fallback1 = RAND_URL(seed + '-retry1');
  const fallback2 = SAY_URL('hello', seed + '-retry2');

  el.innerHTML = `
    <div class="topbar"></div>
    <img id="catimg" src="${item.src}" alt="A cute cat from CATAAS" />
    <div class="footfade"></div>
    <span class="label like" aria-hidden="true" style="opacity:0; transform:rotate(-8deg)">Like</span>
    <span class="label nope" aria-hidden="true" style="opacity:0; transform:rotate(8deg)">Nope</span>
  `;

  const img = el.querySelector('#catimg') as HTMLImageElement;
  let tries = 0;
  
  img.onerror = () => {
    tries++;
    if (tries === 1) img.src = fallback1;
    else if (tries === 2) img.src = fallback2;
    else if (img.parentNode) img.remove();
  };

  enableDrag(el, item);
  return el;
}

function stack() {
  if (!deckEl) return;
  
  deckEl.innerHTML = '';
  const remaining = state.items.slice(state.index);
  
  remaining.forEach((item, i) => {
    const card = createCard(item, i);
    const offset = i * 4;
    card.style.transform = `translate(0px, ${offset}px)`;
    card.style.opacity = String(1 - Math.min(i * 0.07, 0.5));
    card.classList.toggle('ghost', i > 0);
    deckEl.appendChild(card);
  });
  
  renderProgress();
  showHint();
}

function enableDrag(card: HTMLElement, item: CatItem) {
  const likeTag = card.querySelector('.label.like') as HTMLElement;
  const nopeTag = card.querySelector('.label.nope') as HTMLElement;
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    const rect = card.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    dx = 0;
    dy = 0;
    card.style.cursor = 'grabbing';
    card.style.transition = 'none';
    if (e.pointerId !== undefined && card.setPointerCapture) {
      card.setPointerCapture(e.pointerId);
    }
    hideHint();
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    
    const rect = card.getBoundingClientRect();
    dx = e.clientX - rect.left - startX;
    dy = e.clientY - rect.top - startY;
    const rot = dx / 18;
    
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    
    if (likeTag && nopeTag) {
      likeTag.style.opacity = Math.max(0, Math.min(1, (dx - 30) / 80)).toString();
      nopeTag.style.opacity = Math.max(0, Math.min(1, (-dx - 30) / 80)).toString();
    }
  };

  const onUp = async () => {
    if (!dragging) return;
    dragging = false;
    card.style.cursor = 'grab';
    
    const threshold = 90;
    if (dx > threshold) {
      await fling(card, 1);
      act('like', item);
    } else if (dx < -threshold) {
      await fling(card, -1);
      act('nope', item);
    } else {
      card.style.transition = 'transform .18s ease';
      card.style.transform = 'translate(0, 0)';
      if (likeTag && nopeTag) {
        likeTag.style.opacity = '0';
        nopeTag.style.opacity = '0';
      }
      await sleep(180);
      card.style.transition = '';
    }
  };

  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);
  card.addEventListener('pointerleave', onUp);
}

async function fling(card: HTMLElement, dir: number) {
  const dx = dir * (window.innerWidth * 0.9);
  card.style.transition = 'transform .22s ease-out, opacity .22s ease-out';
  card.style.transform = `translate(${dx}px, -30px) rotate(${12 * dir}deg)`;
  card.style.opacity = '0';
  await sleep(220);
}

function act(kind: 'like' | 'nope', item: CatItem) {
  if (kind === 'like') state.liked.push(item);
  else state.disliked.push(item);
  
  state.index++;
  
  if (state.index >= state.items.length) {
    showSummary();
  } else {
    stack();
  }
}

function showSummary() {
  if (!deckEl || !doneEl || !summaryEl) return;
  
  deckEl.style.display = 'none';
  doneEl.style.display = 'flex';
  likeBtn.disabled = true;
  nopeBtn.disabled = true;
  
  const liked = state.liked.length;
  const total = state.items.length;
  
  summaryEl.innerHTML = `
    <h2>You liked ${liked} / ${total} cats</h2>
    <p>${liked ? 'Here are your favourites:' : 'No worries — try again for new fluffers.'}</p>
    ${liked ? '<div class="grid">' + state.liked.map(i => 
      `<img loading="lazy" src="${i.src}" alt="Liked cat">`
    ).join('') + '</div>' : ''}
    <div style="margin-top:14px; display:flex; gap:8px">
      <button class="btn" id="again">Try Again</button>
      ${liked ? `<a class="btn like" id="download" href="#" title="Download your liked list">⤓</a>` : ''}
    </div>
  `;
  
  const againBtn = summaryEl.querySelector('#again');
  if (againBtn) {
    againBtn.addEventListener('click', init);
  }
  
  const dl = summaryEl.querySelector('#download') as HTMLAnchorElement;
  if (dl) {
    const text = state.liked.map(x => x.src).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    dl.href = URL.createObjectURL(blob);
    dl.setAttribute('download', 'cat-likes.txt');
  }
}

function showHint() {
  if (!hintEl) return;
  
  hintEl.style.opacity = '0';
  hintEl.style.display = 'block';
  
  // Trigger reflow
  void hintEl.offsetWidth;
  
  hintEl.style.transition = 'opacity 0.5s ease 1s';
  hintEl.style.opacity = '1';
  
  setTimeout(() => {
    if (hintEl) {
      hintEl.style.transition = 'opacity 0.5s ease';
      hintEl.style.opacity = '0';
    }
  }, 3000);
}

function hideHint() {
  if (!hintEl) return;
  
  hintEl.style.transition = 'opacity 0.3s ease';
  hintEl.style.opacity = '0';
}

// Initialize the app
async function init() {
  state.items = [];
  state.index = 0;
  state.liked = [];
  state.disliked = [];
  
  if (counterEl) counterEl.textContent = '0';
  likeBtn.disabled = false;
  nopeBtn.disabled = false;
  
  if (doneEl) doneEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';
  if (deckEl) deckEl.style.display = 'none';
  if (loadingEl) loadingEl.style.display = 'flex';
  
  try {
    const items = await fetchCats(COUNT);
    state.items = items;
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (deckEl) deckEl.style.display = 'block';
    
    stack();
  } catch (e) {
    console.error('Failed to load cats:', e);
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'flex';
  }
}

// Event Listeners
function setupEventListeners() {
  // Like/Dislike buttons
  likeBtn.addEventListener('click', () => {
    const item = state.items[state.index];
    if (!item) return;
    
    const top = deckEl?.lastElementChild as HTMLElement;
    if (!top) return;
    
    fling(top, 1).then(() => act('like', item));
  });
  
  nopeBtn.addEventListener('click', () => {
    const item = state.items[state.index];
    if (!item) return;
    
    const top = deckEl?.lastElementChild as HTMLElement;
    if (!top) return;
    
    fling(top, -1).then(() => act('nope', item));
  });
  
  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') likeBtn.click();
    if (e.key === 'ArrowLeft') nopeBtn.click();
  });
  
  // Retry button
  if (retryBtn) {
    retryBtn.addEventListener('click', init);
  }
}

// Export the init function for main.ts
export function initApp() {
  console.log('Initializing app...');
  setupEventListeners();
  init();
}

// For direct script usage
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing app...');
    initApp();
  });

  if (document.readyState !== 'loading') {
    console.log('DOM already loaded, initializing app immediately');
    initApp();
  }
}
