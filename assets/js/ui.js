(function (app) {
  "use strict";

  var THEME_KEY = "paprint_theme";
  var DARK_STYLESHEET_ID = "paprintDarkModeStyles";

  function ensureThemeStylesheet() {
    if (document.getElementById(DARK_STYLESHEET_ID)) return;

    var link = document.createElement("link");
    link.id = DARK_STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href = "assets/css/pages/dark-mode.css";
    document.head.appendChild(link);
  }

  function getSavedTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      return saved === "dark" || saved === "light" ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function preferredTheme() {
    var saved = getSavedTheme();

    if (saved) return saved;

    if (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || preferredTheme();
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // Theme still works for the current page when storage is unavailable.
    }
  }

  function updateThemeControls(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      var dark = theme === "dark";
      var icon = button.querySelector("[data-theme-icon]");
      var label = button.querySelector("[data-theme-label]");

      if (icon) icon.textContent = dark ? "☀" : "☾";
      if (label) label.textContent = dark ? "Light" : "Dark";

      button.setAttribute(
        "aria-label",
        dark ? "Switch to light mode" : "Switch to dark mode"
      );
      button.setAttribute(
        "title",
        dark ? "Switch to light mode" : "Switch to dark mode"
      );
      button.setAttribute("aria-pressed", String(dark));
    });
  }

  function setTheme(theme, persist) {
    var normalized = theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", normalized);
    document.documentElement.style.colorScheme = normalized;

    if (persist !== false) {
      saveTheme(normalized);
    }

    updateThemeControls(normalized);
  }

  function toggleTheme() {
    setTheme(currentTheme() === "dark" ? "light" : "dark", true);
  }

  ensureThemeStylesheet();
  setTheme(preferredTheme(), false);

  var navItems = [
    { id: "dashboard", label: "Dashboard", href: "index.html", icon: "layout-dashboard" },
    { id: "requests", label: "Incoming Requests", href: "incoming-requests.html", icon: "inbox" },
    { id: "queue", label: "Job Queue", href: "queue.html", icon: "list-ordered" },
    { id: "customers", label: "Customers", href: "customers.html", icon: "users" },
    { id: "history", label: "History", href: "history.html", icon: "history" },
    { id: "reports", label: "Reports", href: "reports.html", icon: "chart" }
  ];
  var moreItems = [
    { id: "services", label: "Services", href: "services.html", icon: "grid" },
    { id: "backup", label: "Backup & Restore", href: "backup.html", icon: "download" },
    { id: "public", label: "Public Queue", href: "public-queue.html", icon: "monitor" }
  ];
  var iconPaths = {
    "layout-dashboard": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    inbox:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>',
    "list-ordered":'<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 5h1v4M3 17h3l-3 4h3"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    chart:'<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    monitor:'<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 21h8M12 18v3"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>'
  };
  function navIcon(name) {return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[name]||iconPaths.grid)+'</svg>';}

  // Unseen customer requests, tracked only within this browser.
  var SEEN_REQUESTS_KEY = "paprint_v1_seen_incoming_request_ids";
  var REQUESTS_KEY = "paprint_v1_requests";

  function requestIds(pendingOnly) {
    try {
      if (!app.storage || typeof app.storage.getRequests !== "function") return [];
      return app.storage.getRequests().filter(function (request) {
        return request && request.id != null && (!pendingOnly || request.status === "pending");
      }).map(function (request) { return String(request.id); });
    } catch (error) { return []; }
  }

  function seenRequestIds() {
    try {
      var saved = JSON.parse(localStorage.getItem(SEEN_REQUESTS_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) { return []; }
  }

  function markRequestsSeen() {
    try {
      localStorage.setItem(SEEN_REQUESTS_KEY, JSON.stringify(requestIds(false)));
    } catch (error) {
      // The badge is optional if browser storage is blocked.
    }
  }

  function refreshRequestBadge() {
    var seen = new Set(seenRequestIds());
    var unseen = requestIds(true).filter(function (id) { return !seen.has(id); }).length;
    document.querySelectorAll("[data-incoming-count]").forEach(function (badge) {
      badge.textContent = unseen > 99 ? "99+" : String(unseen);
      badge.hidden = unseen === 0;
      badge.setAttribute("aria-label", unseen + " new incoming requests");
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key !== REQUESTS_KEY && event.key !== SEEN_REQUESTS_KEY) return;
    if (event.key === REQUESTS_KEY &&
        location.pathname.split("/").pop() === "incoming-requests.html") {
      markRequestsSeen();
    }
    refreshRequestBadge();
  });
  window.addEventListener("focus", refreshRequestBadge);

  function sidebarMarkup(activePage) {
    function navLink(item) {
      var active = item.id === activePage ? " active" : "";
      return '<a class="nav-link'+active+'" href="'+item.href+'"'+(active?' aria-current="page"':'')+'><span class="nav-icon">'+navIcon(item.icon)+'</span><span>'+app.escapeHTML(item.label)+'</span>'+(item.id==='requests'?'<span class="nav-request-badge" data-incoming-count hidden></span>':'')+'</a>';
    }
    return '<a class="brand" href="index.html"><img class="brand-logo" src="assets/images/logo.png" alt=""><span class="brand-name">Pa<span>Print</span></span></a>'+
      '<nav class="nav-group" aria-label="Main navigation">'+navItems.map(navLink).join('')+
      '<details class="nav-more"'+(moreItems.some(function(item){return item.id===activePage;})?' open':'')+'><summary class="nav-link"><span class="nav-icon">'+navIcon('grid')+'</span><span>More</span><span class="nav-chevron">'+navIcon('chevron')+'</span></summary>'+moreItems.map(navLink).join('')+'</details></nav>';
  }
  function initCustomerShell(active) {
    var host=document.querySelector('#customerNav');if(!host)return;
    host.className='customer-topbar';
    host.innerHTML='<a class="brand customer-brand" href="print-request.html"><img class="brand-logo" src="assets/images/logo.png" alt=""><span class="brand-name">Pa<span>Print</span></span></a><nav class="customer-navlinks" aria-label="Customer navigation"><a class="btn btn-neutral btn-sm'+(active==='request'?' active':'')+'" href="print-request.html">Print Request</a><a class="btn btn-neutral btn-sm'+(active==='track'?' active':'')+'" href="track-order.html">Track Order</a><a class="btn btn-neutral btn-sm" href="index.html">Staff View</a><button class="btn btn-neutral btn-sm" data-theme-toggle type="button"><span data-theme-icon>☾</span> <span data-theme-label>Dark</span></button></nav>';
    var toggle=host.querySelector('[data-theme-toggle]');toggle.addEventListener('click',toggleTheme);updateThemeControls(currentTheme());
  }
  function topbarMarkup(title) {
    return (
      '<div class="topbar-start">' +
        '<button class="btn btn-neutral mobile-nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-label="Open navigation">☰</button>' +
        '<span class="sr-only">' + app.escapeHTML(title) + '</span>' +
      "</div>" +
      '<div class="topbar-actions">' +
        '<a class="btn btn-secondary btn-sm" href="print-request.html">Customer View</a>' +
        '<button class="btn btn-neutral btn-sm theme-toggle" type="button" data-theme-toggle aria-pressed="false">' +
          '<span class="theme-toggle-icon" data-theme-icon aria-hidden="true">☾</span>' +
          '<span class="theme-toggle-label" data-theme-label>Dark</span>' +
        "</button>" +
        '<a class="btn btn-primary btn-sm" href="new-job.html">+ New Job</a>' +
      "</div>"
    );
  }

  function syncFilterStates(){
    document.querySelectorAll('select[id*="Filter"],select[id*="filter"],select[id*="Status"],select[id*="Service"],select[id*="Priority"],select[id*="history"],input[type="date"]').forEach(function(el){
      var value=String(el.value||'').toLowerCase();
      el.classList.toggle('filter-applied',!!value&&!['all','all services','all requests',''].includes(value));
    });
  }
  document.addEventListener('change',syncFilterStates);
  function initShell(options) {
    options = options || {};
    if (options.activePage === "requests") markRequestsSeen();

    var sidebar = document.querySelector("#sidebar");
    var topbar = document.querySelector("#topbar");

    if (sidebar) {
      sidebar.classList.add("sidebar");
      sidebar.innerHTML = sidebarMarkup(options.activePage || "");
      refreshRequestBadge();
    }

    if (topbar) {
      topbar.classList.add("topbar");
      topbar.innerHTML = topbarMarkup(options.title || "PaPrint");
    }

    var navToggle = document.querySelector("[data-nav-toggle]");
    var themeToggle = document.querySelector("[data-theme-toggle]");

    if (navToggle) {
      navToggle.addEventListener("click", function () {
        var isOpen = document.body.classList.toggle("nav-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener("click", toggleTheme);
      updateThemeControls(currentTheme());
    }

    document.addEventListener("click", function (event) {
      if (window.innerWidth > 780) return;
      if (!document.body.classList.contains("nav-open")) return;
      if (event.target.closest("#sidebar") || event.target.closest("[data-nav-toggle]")) return;

      document.body.classList.remove("nav-open");

      if (navToggle) {
        navToggle.setAttribute("aria-expanded", "false");
      }
    });

    ensureToastRegion();
    syncFilterStates();
  }

  function ensureToastRegion() {
    if (document.querySelector("#toastRegion")) return;

    var region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.appendChild(region);
  }

  function toast(message) {
    ensureToastRegion();

    var region = document.querySelector("#toastRegion");
    var item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;

    region.appendChild(item);

    window.setTimeout(function () {
      item.remove();
    }, 3200);
  }

  function confirmAction(options) {
    options = options || {};

    return new Promise(function (resolve) {
      var backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">' +
          '<h2 id="confirmTitle">' + app.escapeHTML(options.title || "Confirm action") + "</h2>" +
          "<p>" + app.escapeHTML(options.message || "") + "</p>" +
          '<div class="modal-actions">' +
            '<button class="btn btn-neutral" type="button" data-cancel-confirm>' +
              app.escapeHTML(options.cancelText || "Back") +
            "</button>" +
            '<button class="btn ' + (options.danger ? "btn-danger" : "btn-primary") + '" type="button" data-confirm-action>' +
              app.escapeHTML(options.confirmText || "Confirm") +
            "</button>" +
          "</div>" +
        "</div>";

      document.body.appendChild(backdrop);

      var confirmButton = backdrop.querySelector("[data-confirm-action]");
      var cancelButton = backdrop.querySelector("[data-cancel-confirm]");

      function finish(value) {
        backdrop.remove();
        resolve(value);
      }

      confirmButton.addEventListener("click", function () {
        finish(true);
      });

      cancelButton.addEventListener("click", function () {
        finish(false);
      });

      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop) {
          finish(false);
        }
      });

      confirmButton.focus();
    });
  }

  var pageInit = null;
  var routerStarted = false;
  var navigating = false;
  function registerPageInit(fn){ pageInit=fn; }
  function isPortal(path){return /^(print-request|track-order)\.html$/.test(path);}
  async function navigateTo(url, push){
    if(navigating)return;
    var destination=new URL(url,location.href);
    if(destination.origin!==location.origin)return;
    var path=destination.pathname.split('/').pop()||'index.html';
    var current=location.pathname.split('/').pop()||'index.html';
    if(isPortal(path)!==isPortal(current)){location.href=destination.href;return;}
    if(!/^[a-z0-9-]+\.html$/.test(path))return;
    navigating=true;
    try{
      var response=await fetch(destination.href,{cache:'no-cache'});
      if(!response.ok)throw Error('Navigation failed');
      var markup=await response.text();
      var doc=new DOMParser().parseFromString(markup,'text/html');
      var sourceMain=doc.querySelector('.main');var targetMain=document.querySelector('.main');
      if(!sourceMain||!targetMain)throw Error('Unsupported page');
      var pageStyles=Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(function(x){return x.getAttribute('href');}).filter(function(x){return x&&x!=='assets/css/app.css';});
      document.querySelectorAll('link[data-route-style]').forEach(function(x){x.remove();});
      pageStyles.forEach(function(href){var l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.routeStyle='true';document.head.appendChild(l);});
      targetMain.innerHTML=sourceMain.innerHTML;
      document.title=doc.title;
      var extras=Array.from(doc.querySelectorAll('script[src]')).map(function(x){return x.getAttribute('src');}).filter(function(x){return x&&x.startsWith('assets/js/')&&!x.startsWith('assets/js/pages/');});
      for(var j=0;j<extras.length;j++){var extra=extras[j];if(!document.querySelector('script[src="'+extra+'"]')){var libResponse=await fetch(extra);if(!libResponse.ok)throw Error('Missing dependency');var lib=document.createElement('script');lib.src=extra;document.body.appendChild(lib);await new Promise(function(resolve,reject){lib.onload=resolve;lib.onerror=reject;});}}
      var script=Array.from(doc.querySelectorAll('script[src]')).map(function(x){return x.getAttribute('src');}).filter(function(x){return x&&x.startsWith('assets/js/pages/');}).pop();
      if(!script)throw Error('Missing page script');
      var sr=await fetch(script,{cache:'no-cache'});if(!sr.ok)throw Error('Missing page script');
      var source=await sr.text();
      if(!/document\.addEventListener\(\s*["']DOMContentLoaded["']\s*,\s*function/.test(source))throw Error('Unsupported page initialization');
      source=source.replace(/document\.addEventListener\(\s*["']DOMContentLoaded["']\s*,\s*function/, 'PaPrint.ui.registerPageInit(function');
      pageInit=null;
      var run=document.createElement('script');run.textContent=source;document.body.appendChild(run);run.remove();
      if(!pageInit)throw Error('Could not initialize page');
      if(push)history.pushState({page:path},'',destination.href);
      pageInit();syncFilterStates();window.scrollTo(0,0);
    }catch(error){location.href=destination.href;}
    finally{navigating=false;}
  }
  function startRouter(){
    if(routerStarted)return;routerStarted=true;
    document.addEventListener('click',function(event){
      var anchor=event.target.closest('a[href]');if(!anchor||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||anchor.target||anchor.hasAttribute('download'))return;
      var dest=new URL(anchor.href,location.href);
      if(dest.origin!==location.origin||!dest.pathname.endsWith('.html')||dest.pathname===location.pathname&&dest.search===location.search)return;
      if(isPortal(dest.pathname.split('/').pop())!==isPortal(location.pathname.split('/').pop()))return;
      if (dest.pathname.split('/').pop() === 'incoming-requests.html') {
        markRequestsSeen();
        refreshRequestBadge();
      }
      event.preventDefault();navigateTo(dest.href,true);
    });
    window.addEventListener('popstate',function(){navigateTo(location.href,false);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRouter);else startRouter();
  app.ui = {
    registerPageInit: registerPageInit,

    initCustomerShell: initCustomerShell,
    initShell: initShell,
    toast: toast,
    confirmAction: confirmAction,
    getTheme: currentTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme
  };
})(window.PaPrint);
