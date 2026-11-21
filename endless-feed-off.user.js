// ==UserScript==
// @name         Endless Feed Off
// @namespace    endless-feed-off
// @version      1.6.0
// @description  instagram.com'da Reels sekmesini ve sonsuz Reels kaydırmasını kapatır, reklamları gizler. Akıştaki Reels yerinde izlenebilir.
// @match        https://www.instagram.com/*
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ozgurtaskiran983/endless-feed-off/main/endless-feed-off.user.js
// @downloadURL  https://raw.githubusercontent.com/ozgurtaskiran983/endless-feed-off/main/endless-feed-off.user.js
// ==/UserScript==

(function () {
  'use strict';

  // --- AYARLAR ---
  const AYAR = {
    kesfetGizle: true,   // Keşfet'teki video/foto ızgarasını gizle (arama çalışır)
    reklamGizle: true,   // Reklam gönderilerini gizle
    // Reklam etiketi: İngilizce (Ad, Sponsored) ve Türkçe (Sponsorlu)
    reklamYazilari: ['Ad', 'Sponsored', 'Sponsorlu'],
    // Bir gönderinin reklam etiketi geç yüklenebilir: her gönderiye bu kadar kez bakılır
    // (her bakış arası 0,3 sn, yani yaklaşık 3 saniye)
    reklamBakisSayisi: 10
  };

  // "Ad Blocked" görseli (ikon + başlık). Koyu/açık tema için başlık rengi değişir.
  function reklamGorseli(baslikRengi) {
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
  const koyuGorsel = reklamGorseli('#f5f5f5');
  const acikGorsel = reklamGorseli('#262626');

  const css = `
    /* Reels sekmesi (alt menü ve profillerdeki sekme). İçinde video olan linklere dokunma. */
    a[href*="/reels/"]:not(:has(video)) { display: none !important; }

    /* Keşfet ızgarası */
    html.efo-kesfet main a[href*="/p/"],
    html.efo-kesfet main a[href*="/reel/"] { display: none !important; }

    /* Reklamlar: gönderiyi silmiyoruz (silince akış takılıyor), üstünü örtüyoruz.
       Boyutu aynı kaldığı için yeni gönderiler yüklenmeye devam eder. */
    article.efo-reklam { position: relative !important; }
    /* Alt katman: reklamın tamamını düz renkle örter */
    article.efo-reklam::before {
      content: ""; position: absolute; inset: 0; z-index: 2147483646;
      background: #000;
    }
    /* Üst katman: çift kesikli çerçeve + ortada ikon ve yazı */
    article.efo-reklam::after {
      content: ""; position: absolute; inset: 16px; z-index: 2147483647;
      border: 2px dashed #3a3a3a; border-radius: 12px;
      outline: 2px dashed #3a3a3a; outline-offset: -12px; /* içteki ikinci kesikli çizgi */
      background: ${koyuGorsel} center / 260px 150px no-repeat;
    }
    @media (prefers-color-scheme: light) {
      article.efo-reklam::before { background: #fafafa; }
      article.efo-reklam::after {
        border-color: #dbdbdb; outline-color: #dbdbdb;
        background: ${acikGorsel} center / 260px 150px no-repeat;
      }
    }
  `;

  function stilEkle() {
    if (document.getElementById('efo-stil')) return;
    const s = document.createElement('style');
    s.id = 'efo-stil';
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

  // 2) Yine de Reels sayfasına girildiyse ana sayfaya dön.
  //    İstisna: başka bir platformdan linkle gelen Reels. O tek Reels izlenebilir.
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
      document.documentElement.classList.toggle('efo-kesfet', kesfette);
    }
    if (AYAR.reklamGizle) reklamlariGizle();
  }

  // 3) Reklam gönderilerini bul: içinde tek başına "Ad" / "Sponsored" / "Sponsorlu" yazan gönderiler.
  //    Etiket geç yüklenebildiği için her gönderiye birkaç kez bakılır.
  function reklamlariGizle() {
    document.querySelectorAll('article:not(.efo-reklam)').forEach(art => {
      const bakis = Number(art.dataset.efoBakis || 0);
      if (bakis >= AYAR.reklamBakisSayisi) return; // yeterince bakıldı, reklam değil
      art.dataset.efoBakis = bakis + 1;
      const etiketVar = [...art.querySelectorAll('span, a, div')].some(el =>
        el.childElementCount === 0 &&
        AYAR.reklamYazilari.includes(el.textContent.trim()));
      if (etiketVar) art.classList.add('efo-reklam');
    });
    // Örtünün altındaki reklam videoları sessiz ve durmuş kalsın
    document.querySelectorAll('article.efo-reklam video').forEach(v => {
      v.muted = true;
      if (!v.paused) v.pause();
    });
  }

  // 4) DM'den ya da dışarıdan linkle açılan Reels: ilkini izlet, bir sonrakine geçilirse çık.
  //    Kaydırınca adres her zaman değişmiyor, o yüzden oynayan videoyu takip ediyoruz.
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

  // 5) "Uygulamayı indir" şeridi: Safari'nin okuduğu etiketi silmeye çalış.
  //    Safari bu etiketi sayfa yüklenirken okur; yüklendikten sonra izlemeyi bırakıyoruz (pil için).
  function seritEtiketiniSil() {
    document.querySelectorAll('meta[name="apple-itunes-app"]').forEach(m => m.remove());
  }
  seritEtiketiniSil();
  const seritGozcusu = new MutationObserver(seritEtiketiniSil);
  seritGozcusu.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', () => {
    seritEtiketiniSil();
    setTimeout(() => seritGozcusu.disconnect(), 3000);
  });

  kontrol();
  setInterval(kontrol, 300);
})();
