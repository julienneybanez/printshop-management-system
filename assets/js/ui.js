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
    { id: "dashboard", label: "Dashboard", href: "index.html", icon: "⌂" },
    { id: "customers", label: "Customers", href: "customers.html", icon: "♙" },
    { id: "services", label: "Services", href: "services.html", icon: "▦" },
    { id: "new-job", label: "New Print Job", href: "new-job.html", icon: "＋" },
    { id: "review", label: "Order Review", href: "order-review.html", icon: "✓" },
    { id: "queue", label: "Job Queue", href: "queue.html", icon: "≡" },
    { id: "history", label: "History", href: "history.html", icon: "↺" },
    { id: "backup", label: "Backup & Restore", href: "backup.html", icon: "⇩" },
    { id: "reports", label: "Reports", href: "reports.html", icon: "▥" },
    { id: "public", label: "Public Queue", href: "public-queue.html", icon: "◉" }
  ];

  function sidebarMarkup(activePage) {
    var nav = navItems.map(function (item) {
      var active = item.id === activePage ? " active" : "";

      return (
        '<a class="nav-link' + active + '" href="' + item.href + '"' +
        (item.id === activePage ? ' aria-current="page"' : "") +
        '><span class="nav-icon" aria-hidden="true">' + item.icon + "</span>" +
        app.escapeHTML(item.label) + "</a>"
      );
    }).join("");

    return (
      '<a class="brand" href="index.html">' +
        '<img class="brand-logo" src="assets/images/logo.png" alt="">' +
        '<span class="brand-name">Pa<span>Print</span></span>' +
      "</a>" +
      '<nav class="nav-group" aria-label="Main navigation">' + nav + "</nav>"
    );
  }

  function topbarMarkup(title) {
    return (
      '<div class="topbar-start">' +
        '<button class="btn btn-neutral mobile-nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-label="Open navigation">☰</button>' +
        '<h2 class="topbar-title">' + app.escapeHTML(title) + "</h2>" +
      "</div>" +
      '<div class="topbar-actions">' +
        '<a class="btn btn-secondary btn-sm" href="public-queue.html">Public Queue</a>' +
        '<button class="btn btn-neutral btn-sm theme-toggle" type="button" data-theme-toggle aria-pressed="false">' +
          '<span class="theme-toggle-icon" data-theme-icon aria-hidden="true">☾</span>' +
          '<span class="theme-toggle-label" data-theme-label>Dark</span>' +
        "</button>" +
        '<a class="btn btn-primary btn-sm" href="new-job.html">+ New Job</a>' +
      "</div>"
    );
  }

  function initShell(options) {
    options = options || {};

    var sidebar = document.querySelector("#sidebar");
    var topbar = document.querySelector("#topbar");

    if (sidebar) {
      sidebar.classList.add("sidebar");
      sidebar.innerHTML = sidebarMarkup(options.activePage || "");
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

  app.ui = {
    initShell: initShell,
    toast: toast,
    confirmAction: confirmAction,
    getTheme: currentTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme
  };
})(window.PaPrint);
