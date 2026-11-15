/* HD68 analytics hotfix 1.1: unobstructed poster, GA4 consent-denied signals. */
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
  let choice = null;
  let clarityLoaded = false;
  try { choice = localStorage.getItem(consentKey); } catch (e) {}
  function isAllowed() { return choice === 'yes'; }
  const adDenied = {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
  const params = new URLSearchParams(location.search);
  function campaign(field) { return (params.get(field)||'').slice(0,90); }
  function remember(value) { try {localStorage.setItem(consentKey,value);} catch(e){} }

  /* GA4 advanced consent mode. No analytics cookies by default. Depending on
     jurisdiction and configuration, consent-denied cookieless signals may be
     reported in aggregate, not as reliable unique users or sessions. */
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
    if(banner) banner.hidden=true;
    if(allow){
      if(gaValid)window.gtag('consent','update',Object.assign({analytics_storage:'granted'},adDenied));
      loadClarity();
    } else if(wasAllowed){
      if(gaValid)window.gtag('consent','update',Object.assign({analytics_storage:'denied'},adDenied));
      if(clarityLoaded && typeof window.clarity==='function')window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'});
      location.reload();
    }
  }
  // Do not pop up a banner automatically. Privacy remains accessible on request.
  if(banner)banner.hidden=true;
  if(settings && banner)settings.addEventListener('click',function(){banner.hidden=false;});
  if(consentAllow)consentAllow.addEventListener('click',function(){choose(true);});
  if(consentReject)consentReject.addEventListener('click',function(){choose(false);});

  function sendCta(eventName,anchor,label){
    if(gaValid && typeof window.gtag==='function')window.gtag('event',eventName,{
      cta_name:label,destination_domain:new URL(anchor.href).hostname,
      page_variant:String(cfg.pageVariant||'unknown'),transport_type:'beacon'
    });
    if(clarityLoaded && typeof window.clarity==='function'){
      window.clarity('event',eventName);
      window.clarity('set','last_cta',label);
    }
  }
  const customer=document.querySelector('a.cta.customer');
  const reward=document.querySelector('a.cta.reward');
  if(customer)customer.addEventListener('click',function(){sendCta('cta_customer_click',customer,'加入客服');});
  if(reward)reward.addEventListener('click',function(){sendCta('cta_reward_click',reward,'獲得600點數');});
  window.HD68Analytics={status:function(){return {
    ga4Configured:gaValid,clarityConfigured:clarityValid,
    consent:choice||'unset',ga4Cookieless:!isAllowed(),clarityActive:clarityLoaded
  };}};
})();
