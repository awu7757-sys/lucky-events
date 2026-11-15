/* HD68 analytics v1.2: GA4 + consent-respecting Clarity + first-party D1 events. */
(function () {
  'use strict';
  const cfg = window.HD68_ANALYTICS_CONFIG || {};
  const gaId = String(cfg.ga4MeasurementId || '').trim().toUpperCase();
  const clarityId = String(cfg.clarityProjectId || '').trim();
  const gaValid = /^G-[A-Z0-9]{6,20}$/.test(gaId);
  const clarityValid = /^[a-zA-Z0-9_-]{5,64}$/.test(clarityId);
  const consentKey = 'hd68_analytics_consent_v1';
  const visitorKey = 'hd68_visitor_id_v1';
  const sessionKey = 'hd68_session_id_v1';
  const collectUrl = 'https://hd68-analytics-api.awu7757.workers.dev/collect';
  const banner = document.getElementById('hd68-consent');
  const consentAllow = document.getElementById('hd68-consent-allow');
  const consentReject = document.getElementById('hd68-consent-reject');
  const settings = document.getElementById('hd68-privacy-settings');
  let choice = null;
  let clarityLoaded = false;
  try { choice = localStorage.getItem(consentKey); } catch (_) {}
  function isAllowed() { return choice === 'yes'; }
  const adDenied = {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
  const params = new URLSearchParams(location.search);
  function campaign(field) { return (params.get(field) || '').slice(0,90); }
  function remember(value) { try {localStorage.setItem(consentKey,value);} catch (_) {} }

  /* Identifiers are created and retained only after affirmative consent.
     Without consent, we count events but cannot measure unique/returning users. */
  function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }
  function storedId(storage, key) {
    if (!isAllowed() || !storage) return null;
    try {
      let id = storage.getItem(key);
      if (!id || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) {
        id = newId();
        if (id) storage.setItem(key, id);
      }
      return id || null;
    } catch (_) { return null; }
  }
  function clearIds() {
    try {localStorage.removeItem(visitorKey);} catch (_) {}
    try {sessionStorage.removeItem(sessionKey);} catch (_) {}
  }
  if (!isAllowed()) clearIds();

  // Do not automatically show the consent banner; leave privacy settings accessible.
  if (banner) banner.hidden = true;

  /* GA4 advanced consent mode: cookie-denied by default. */
  if (gaValid) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',Object.assign({analytics_storage:'denied'},adDenied));
    if (isAllowed()) window.gtag('consent','update',Object.assign({analytics_storage:'granted'},adDenied));
    window.gtag('js',new Date());
    window.gtag('config',gaId,{send_page_view:true});
    const script=document.createElement('script');
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(gaId);
    document.head.appendChild(script);
  }

  function loadClarity() {
    if (!clarityValid || clarityLoaded || !isAllowed()) return;
    clarityLoaded=true;
    window.clarity=window.clarity || function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};
    window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(field){
      const v=campaign(field); if(v)window.clarity('set',field,v);
    });
    const script=document.createElement('script');
    script.async=true;
    script.src='https://www.clarity.ms/tag/'+encodeURIComponent(clarityId);
    document.head.appendChild(script);
  }
  if (isAllowed()) loadClarity();

  function choose(allow) {
    const wasAllowed=isAllowed();
    choice=allow?'yes':'no';
    remember(choice);
    if (banner) banner.hidden=true;
    if (allow) {
      if(gaValid)window.gtag('consent','update',Object.assign({analytics_storage:'granted'},adDenied));
      loadClarity();
    } else {
      clearIds();
      if(gaValid)window.gtag('consent','update',Object.assign({analytics_storage:'denied'},adDenied));
      if (clarityLoaded && typeof window.clarity==='function'){
        window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});
      }
      if(wasAllowed) location.reload();
    }
  }
  if(settings && banner)settings.addEventListener('click',function(){banner.hidden=false;});
  if(consentAllow)consentAllow.addEventListener('click',function(){choose(true);});
  if(consentReject)consentReject.addEventListener('click',function(){choose(false);});

  function referrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname.slice(0,120) : ''; }
    catch (_) { return ''; }
  }
  function collect(eventName) {
    const payload = {
      event_id: newId(),
      event_name: eventName,
      consent_status: choice || 'unset',
      visitor_id: isAllowed() ? storedId(localStorage, visitorKey) : null,
      session_id: isAllowed() ? storedId(sessionStorage, sessionKey) : null,
      utm_source: campaign('utm_source'),
      utm_medium: campaign('utm_medium'),
      utm_campaign: campaign('utm_campaign'),
      utm_content: campaign('utm_content'),
      utm_term: campaign('utm_term'),
      referrer_host: referrerHost(),
      page_path: location.pathname
    };
    if (!payload.event_id) return;
    const body = JSON.stringify(payload);
    // text/plain avoids an unnecessary CORS preflight for quick outbound clicks.
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body],{type:'text/plain;charset=UTF-8'});
        if (navigator.sendBeacon(collectUrl,blob)) return;
      }
    } catch (_) {}
    try {
      fetch(collectUrl, {
        method:'POST', mode:'cors', credentials:'omit', keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'}, body
      }).catch(function(){});
    } catch (_) {}
  }

  function sendCta(eventName,anchor,label){
    // Keep existing GA4 and Clarity events unchanged.
    if(gaValid && typeof window.gtag==='function')window.gtag('event',eventName,{
      cta_name:label,destination_domain:new URL(anchor.href).hostname,
      page_variant:String(cfg.pageVariant||'unknown'),transport_type:'beacon'
    });
    if(clarityLoaded && typeof window.clarity==='function'){
      window.clarity('event',eventName);
      window.clarity('set','last_cta',label);
    }
    collect(eventName);
  }

  const customer=document.querySelector('a.cta.customer');
  const reward=document.querySelector('a.cta.reward');
  if(customer)customer.addEventListener('click',function(){sendCta('cta_customer_click',customer,'加入客服');});
  if(reward)reward.addEventListener('click',function(){sendCta('cta_reward_click',reward,'獲得600點數');});
  collect('page_view');

  window.HD68Analytics={status:function(){return {
    ga4Configured:gaValid,clarityConfigured:clarityValid,
    consent:choice||'unset',ga4Cookieless:!isAllowed(),clarityActive:clarityLoaded,
    customAnalyticsConfigured:true,visitorIdAvailable:isAllowed()
  };}};
})();
