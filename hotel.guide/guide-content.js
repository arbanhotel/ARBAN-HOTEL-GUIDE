window.GUIDE_READY = (async () => {
  const endpoint = window.ARBAN_CONNECTION?.publicApi;
  if (!endpoint) return;

  // 기존 사진은 상대 주소로 복원해 한글 파일명 재시도 처리를 유지합니다.
  const guideImagePath = value => {
    if (typeof value !== 'string' || !value) return value;
    try {
      const root = new URL('../', window.location.href);
      const image = new URL(value, root);
      if (image.origin !== root.origin || image.search || image.hash || !image.pathname.startsWith(root.pathname)) return value;
      const path = decodeURI(image.pathname.slice(root.pathname.length));
      return /^(?:image|places|cutouts)\/[^?#]+$/u.test(path) ? '../' + path : value;
    } catch { return value; }
  };

  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') throw Error('HTTPS required');
    const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(6000)});
    if (!response.ok) throw Error('Content unavailable');
    const payload = await response.json();
    const categories = new Set(GUIDE_DATA.categories.map(c=>c.id));
    if (!Array.isArray(payload.places) || !payload.places.every(p=>p && typeof p.id==='string' && typeof p.name==='string' && categories.has(p.category))) throw Error('Invalid content');
    GUIDE_DATA.places = payload.places.filter(p=>!p.hidden).map(place => {
      const restored = {...place};
      for (const field of ['image','listingImage','heroImage','detailImage','characterImage','cutoutImage']) {
        if (typeof restored[field] === 'string') restored[field] = guideImagePath(restored[field]);
      }
      if (Array.isArray(place.extraPhotos)) restored.extraPhotos = place.extraPhotos.map(photo => ({...photo, src:guideImagePath(photo.src)}));
      return restored;
    });
    try {sessionStorage.setItem('arban-public-content',JSON.stringify({endpoint,places:GUIDE_DATA.places}));} catch {}
  } catch {
    GUIDE_DATA.places = [];
    window.GUIDE_CONTENT_ERROR = true;
    console.warn('최신 장소 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
  }
})();
