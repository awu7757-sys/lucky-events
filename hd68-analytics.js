/* HD68 analytics / v1.0 - consent-first, no user-identifying data. */
(function () {
  'use strict';
  const cfg = window.HD68_ANALYTICS_CONFIG || {};
  const gaId = String(cfg.ga4MeasurementId || '').trim().toUpperCase();
  const clarityId = String(cfg.clarityProjectId || '').trim();
  const gaValid = /^G-[A-Z0-9]{6,20}$/.test(gaId);
  const clarityValid = /^[a-zA-Z0-9_-]{5,64}$/.test(clarityId);
  const consentKey = 'hd68_analytics_consent_v1';
  const banner = document.getElementById('hd68-consent');
  const consentAllow = document.getElementById('hd68-consent-allow');
  const consentReject = document.getElementById('hd68-consent-reject');
  const settings = document.getElementById('hd68-privacy-settings');
  const consentOptions = {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
  let enabled = false;
  let choice = null;
  try { choice = localStorage.getItem(consentKey); } catch (e) {}
  const params = new URLSearchParams(window.location.search);
  function getCampaign(field) { return (params.get(field) || '').slice(0,90); }
  function showSettings() { banner.hidden = false; }
  function hideSettings() { banner.hidden = true; }
  function saveChoice(value) { try { localStorage.setItem(consentKey,value); } catch (e) {} }
  function loadGa4() {
    if (!gaValid) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    // Basic consent mode: no Google tag is loaded until a visitor consents.
    window.gtag('consent','default', Object.assign({analytics_storage:'denied'},consentOptions));
    window.gtag('consent','update', Object.assign({analytics_storage:'granted'},consentOptions));
    window.gtag('js',new Date());
    window.gtag('config',gaId,{send_page_view:true});
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(s);
  }
  function loadClarity() {
    if (!clarityValid) return;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    // Ad consent stays denied: do not enable Microsoft Ads personalization.
    window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function (field) {
      const val = getCampaign(field);
      if (val) window.clarity('set',field,val);
    });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(clarityId);
    document.head.appendChild(s);
  }
  function start() {
    if (enabled) return;
    enabled = true;
    loadGa4();
    loadClarity();
  }
  function setChoice(allow) {
    const previouslyActive = enabled;
    choice = allow ? 'yes' : 'no';
    saveChoice(choice);
    hideSettings();
    if (allow) { start(); return; }
    if (previouslyActive) {
      if (typeof window.gtag === 'function') window.gtag('consent','update',Object.assign({analytics_storage:'denied'},consentOptions));
      if (typeof window.clarity === 'function') window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});
      // Unload third-party tracking scripts by reloading, without changing URLs.
      window.location.reload();
    }
  }
  consentAllow.addEventListener('click',function () {setChoice(true);});
  consentReject.addEventListener('click',function () {setChoice(false);});
  settings.addEventListener('click',showSettings);
  if (choice === 'yes') start();
  else if (choice !== 'no') showSettings();

  function sendCta(eventName, anchor, label) {
    if (!enabled) return;
    const data = {
      cta_name: label,
      destination_domain: new URL(anchor.href).hostname,
      page_variant: String(cfg.pageVariant || 'unknown'),
      transport_type: 'beacon'
    };
    if (gaValid && typeof window.gtag === 'function') window.gtag('event',eventName,data);
    if (clarityValid && typeof window.clarity === 'function') {
      window.clarity('event',eventName);
      window.clarity('set','last_cta',label);
    }
  }
  const customer = document.querySelector('a.cta.customer');
  const reward = document.querySelector('a.cta.reward');
  if (customer) customer.addEventListener('click',function () {sendCta('cta_customer_click',customer,'加入客服');});
  if (reward) reward.addEventListener('click',function () {sendCta('cta_reward_click',reward,'獲得600點數');});
  window.HD68Analytics = {status:function(){return {enabled:enabled,ga4Configured:gaValid,clarityConfigured:clarityValid,choice:choice};}};
})();
