/*
 * Team Lider - cookie consent gate for Google Analytics.
 *
 * GA4 does not load until the visitor actively chooses "מאשר". Refusing, or
 * ignoring the banner, leaves no analytics cookie behind. Required since
 * Amendment 13 to the Privacy Protection Law made a cookie identifier
 * personal data; the Privacy Authority's position is opt-in, not opt-out.
 *
 * Loaded from <head> on every page, before the inline scripts that call gtag().
 */
(function () {
  'use strict';

  var GA_ID = 'G-67KSD0RPP4';
  var KEY = 'tl_cookie_consent';   // 'granted' | 'denied'
  var store = {
    get: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }
  };

  // gtag has to exist immediately: the pages call it from their own handlers.
  // Until consent is granted these calls just queue in dataLayer and go nowhere.
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 - everything denied until told otherwise.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted'
  });
  gtag('js', new Date());
  gtag('config', GA_ID);

  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function decide(choice) {
    store.set(choice);
    if (choice === 'granted') loadGA();
    var bar = document.getElementById('tl-consent');
    if (bar) bar.parentNode.removeChild(bar);
  }

  var CSS = [
    '#tl-consent{position:fixed;inset-inline:0;bottom:0;z-index:9999;',
    'background:#0d2135;border-top:1px solid rgba(92,203,240,.28);',
    'box-shadow:0 -8px 30px -10px rgba(0,0,0,.65);',
    "font-family:'Heebo',system-ui,-apple-system,sans-serif;direction:rtl}",
    '#tl-consent .tl-c-in{max-width:1080px;margin:0 auto;padding:16px 20px;',
    'display:flex;flex-wrap:wrap;gap:14px 20px;align-items:center;justify-content:space-between}',
    '#tl-consent p{margin:0;color:rgba(255,255,255,.82);font-size:14.5px;line-height:1.6;',
    'flex:1 1 320px;min-width:0}',
    '#tl-consent a{color:#5CCBF0;text-decoration:underline}',
    '#tl-consent .tl-c-btns{display:flex;gap:10px;flex-wrap:wrap}',
    '#tl-consent button{font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer;',
    'border-radius:100px;padding:11px 22px;min-height:44px;border:1px solid transparent;',
    'transition:filter .15s ease,background .15s ease}',
    '#tl-consent .tl-yes{background:linear-gradient(135deg,#29B5E8,#1E93C4);color:#04121d}',
    '#tl-consent .tl-yes:hover{filter:brightness(1.08)}',
    '#tl-consent .tl-no{background:transparent;color:rgba(255,255,255,.9);',
    'border-color:rgba(255,255,255,.34)}',
    '#tl-consent .tl-no:hover{background:rgba(255,255,255,.08)}',
    '#tl-consent button:focus-visible{outline:3px solid #5CCBF0;outline-offset:2px}',
    '@media (max-width:560px){#tl-consent .tl-c-in{padding:14px 16px}',
    '#tl-consent .tl-c-btns{width:100%}#tl-consent .tl-c-btns button{flex:1 1 0}}'
  ].join('');

  function showBanner() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('section');
    bar.id = 'tl-consent';
    // A region, not a modal: it must not steal focus on every page load,
    // but it sits first in the DOM so keyboard and screen-reader users reach it early.
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'בחירת עוגיות');
    bar.innerHTML =
      '<div class="tl-c-in">' +
        '<p>אנחנו משתמשים בעוגיות של Google Analytics כדי להבין איך משתמשים באתר. ' +
        'זה לא הכרחי לגלישה, ואפשר לסרב בלי שום פגיעה בשימוש. ' +
        '<a href="privacy.html">מדיניות הפרטיות</a></p>' +
        '<div class="tl-c-btns">' +
          '<button type="button" class="tl-yes" data-tl-consent="granted">מאשר</button>' +
          '<button type="button" class="tl-no" data-tl-consent="denied">רק ההכרחי</button>' +
        '</div>' +
      '</div>';

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tl-consent]');
      if (btn) decide(btn.getAttribute('data-tl-consent'));
    });

    document.body.insertBefore(bar, document.body.firstChild);
  }

  var choice = store.get();
  if (choice === 'granted') {
    loadGA();
  } else if (choice !== 'denied') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }

  // Lets the privacy page offer "change my choice" without duplicating any of this.
  window.tlResetCookieConsent = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };
})();
