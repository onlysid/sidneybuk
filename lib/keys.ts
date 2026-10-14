// Several things on one page want the letter keys (the piano and the drum kit both do).
const places = new Map<string, HTMLElement>();
let last = "";

export function claimKeys(id: string, el: HTMLElement) {
  places.set(id, el);
  const take = () => (last = id);
  el.addEventListener("pointerdown", take);
  el.addEventListener("focusin", take);
  return () => {
    el.removeEventListener("pointerdown", take);
    el.removeEventListener("focusin", take);
    places.delete(id);
    if (last === id) last = "";
  };
}
const seen = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};
export function hasKeys(id: string) {
  const mine = places.get(id);
  if (!mine || !seen(mine)) return false;
  const holder = places.get(last);
  if (holder && seen(holder)) return last === id;
  let best = "", near = Infinity;
  for (const [key, el] of places) {
    if (!seen(el)) continue;
    const r = el.getBoundingClientRect();
    const away = Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2);
    if (away < near) (near = away), (best = key);
  }
  return best === id;
}
