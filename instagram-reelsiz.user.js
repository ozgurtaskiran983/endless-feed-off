// ==UserScript==
// @name         Instagram Reelsiz
// @namespace    reelsiz
// @version      1.5.2
// @description  Reels sekmesini ve Reels kaydırma sayfasını kapatır, reklamları gizler. Akıştaki Reels yerinde izlenebilir.
// @match        https://www.instagram.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // --- AYARLAR ---
  const AYAR = {
    kesfetGizle: true,   // Keşfet'teki video/foto ızgarasını gizle (arama çalışır)
    reklamGizle: true,   // Reklam gönderilerini gizle
    // Reklam etiketi: İngilizce (Ad, Sponsored) ve Türkçe (Sponsorlu)
    reklamYazilari: ['Ad', 'Sponsored', 'Sponsorlu']
  };

  // "Ad Blocked" görseli (ikon + başlık). Koyu/açık tema için iki renk.
  function reklamGorseli(baslikRengi, aciklamaRengi) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='150' viewBox='0 0 260 150'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#F58529'/><stop offset='1' stop-color='#DD2A7B'/>
      </linearGradient></defs>
      <circle cx='130' cy='55' r='44' fill='none' stroke='url(#g)' stroke-width='8'/>
      <text x='130' y='67' text-anchor='middle' font-family='-apple-system,Helvetica,Arial,sans-serif'
        font-weight='800' font-size='30' fill='url(#g)'>AD</text>
      <clipPath id='k'><rect x='0' y='0' width='260' height='38'/><rect x='0' y='72' width='260' height='78'/></clipPath>
      <line x1='99' y1='86' x2='161' y2='24' stroke='url(#g)' stroke-width='8' clip-path='url(#k)'/>
      <text x='130' y='140' text-anchor='middle' font-family='-apple-system,Helvetica,Arial,sans-serif'
        font-weight='700' font-size='22' fill='${baslikRengi}'>Ad Blocked</text>
    </svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }
  const koyuGorsel = reklamGorseli('#f5f5f5', '#a8a8a8');
  const acikGorsel = reklamGorseli('#262626', '#737373');

  const css = `
    /* Reels sekmesi (alt menü ve profillerdeki sekme). İçinde video olan linklere dokunma. */
    a[href*="/reels/"]:not(:has(video)) { display: none !important; }

    /* Keşfet ızgarası */
    html.reelsiz-kesfet main a[href*="/p/"],
    html.reelsiz-kesfet main a[href*="/reel/"] { display: none !important; }

    /* Reklamlar: gönderiyi silmiyoruz (silince akış takılıyor), üstünü örtüyoruz.
       Boyutu aynı kaldığı için Instagram yeni gönderileri yüklemeye devam eder. */
    article.reelsiz-reklam { position: relative !important; }
    /* Alt katman: reklamın tamamını düz renkle örter */
    article.reelsiz-reklam::before {
      content: ""; position: absolute; inset: 0; z-index: 2147483646;
      background: #000;
    }
    /* Üst katman: kesikli çerçeve + ortada ikon ve yazı */
    article.reelsiz-reklam::after {
      content: ""; position: absolute; inset: 16px; z-index: 2147483647;
      border: 2px dashed #3a3a3a; border-radius: 12px;
      outline: 2px dashed #3a3a3a; outline-offset: -12px; /* içteki ikinci kesikli çizgi */
      background: ${koyuGorsel} center / 260px 150px no-repeat;
    }
    @media (prefers-color-scheme: light) {
      article.reelsiz-reklam::before { background: #fafafa; }
      article.reelsiz-reklam::after {
        border-color: #dbdbdb; outline-color: #dbdbdb;
        background: ${acikGorsel} center / 260px 150px no-repeat;
      }
    }
  `;

  function stilEkle() {
    if (document.getElementById('reelsiz-stil')) return;
    const s = document.createElement('style');
    s.id = 'reelsiz-stil';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  const reelsAdresi = yol => /^\/reels?(\/|$)/.test(yol) || /^\/[^/]+\/reels\/?$/.test(yol);

  // 1) Reels sayfasına götüren dokunuşları baştan engelle
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    let yol;
    try { yol = new URL(a.href, location.href).pathname; } catch { return; }
    if (reelsAdresi(yol)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // 2) Yine de Reels sayfasına girildiyse geri dön.
  //    İstisna: Instagram dışından (WhatsApp vb.) gelen bir Reels linki. O tek Reels izlenebilir.
  const reelKodu = yol => { const m = yol.match(/^\/reels?\/([^/]+)/); return m ? m[1] : null; };
  let disaridanReel = reelKodu(location.pathname); // sayfa ilk açıldığındaki adres

  let sonYol = null;
  function kontrol() {
    stilEkle();
    const yol = location.pathname;
    if (yol !== sonYol) {
      sonYol = yol;
      if (reelsAdresi(yol)) {
        if (disaridanReel && reelKodu(yol) === disaridanReel) return; // linkle gelinen Reels: izin ver
        disaridanReel = null;
        location.replace('/');
        return;
      }
      disaridanReel = null; // Reels sayfasından çıkıldı, izin bitti
      const kesfette = AYAR.kesfetGizle &&
        yol.startsWith('/explore') && !yol.startsWith('/explore/search');
      document.documentElement.classList.toggle('reelsiz-kesfet', kesfette);
    }
    if (AYAR.reklamGizle) reklamlariGizle();
  }

  // 3) Reklam gönderilerini bul: başlığında tek başına "Ad" yazan gönderiler
  function reklamlariGizle() {
    document.querySelectorAll('article:not([data-reelsiz])').forEach(art => {
      art.setAttribute('data-reelsiz', '1');
      const etiketVar = [...art.querySelectorAll('span, a, div')].some(el =>
        el.childElementCount === 0 &&
        AYAR.reklamYazilari.includes(el.textContent.trim()));
      if (etiketVar) art.classList.add('reelsiz-reklam');
    });
    // Örtünün altındaki reklam videoları sessiz ve durmuş kalsın
    document.querySelectorAll('article.reelsiz-reklam video').forEach(v => {
      v.muted = true;
      if (!v.paused) v.pause();
    });
  }

  // 4) DM'den ya da dışarıdan linkle açılan Reels: ilkini izlet, bir sonrakine geçilirse çık.
  //    Instagram kaydırınca adresi her zaman değiştirmiyor, o yüzden oynayan videoyu takip ediyoruz.
  const dmde = () => location.pathname.startsWith('/direct/');
  const linkReelinde = () => !!disaridanReel && reelsAdresi(location.pathname);
  const izlenecekYer = () => dmde() || linkReelinde();

  let izinliVideo = null, izinliKaynak = null;
  document.addEventListener('play', e => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || !izlenecekYer()) return;
    const kaynak = v.currentSrc || v.src;
    if (!izinliVideo) { izinliVideo = v; izinliKaynak = kaynak; return; }
    if (v === izinliVideo && kaynak === izinliKaynak) return;
    // İkinci bir Reels başladı: durdur ve çık
    v.pause();
    izinliVideo = null;
    if (dmde()) location.replace(location.href); // DM: sohbete dön
    else { disaridanReel = null; location.replace('/'); } // link: ana sayfaya
  }, true);
  // Görüntüleyici kapanınca (video sayfadan kalkınca) sayacı sıfırla
  setInterval(() => {
    if (izinliVideo && (!izinliVideo.isConnected || !izlenecekYer())) {
      izinliVideo = null; izinliKaynak = null;
    }
  }, 500);

  // 5) "Uygulamayı indir" şeridi: Safari'nin okuduğu etiketi silmeye çalış
  function seritEtiketiniSil() {
    document.querySelectorAll('meta[name="apple-itunes-app"]').forEach(m => m.remove());
  }
  seritEtiketiniSil();
  new MutationObserver(seritEtiketiniSil)
    .observe(document.documentElement, { childList: true, subtree: true });

  kontrol();
  setInterval(kontrol, 300);
})();
