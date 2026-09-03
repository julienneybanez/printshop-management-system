(function (app) {
  "use strict";

  var navItems = [
    { id: "dashboard", label: "Dashboard", href: "index.html", icon: "⌂" },
    { id: "services", label: "Services", href: "services.html", icon: "▦" },
    { id: "new-job", label: "New Print Job", href: "new-job.html", icon: "＋" },
    { id: "review", label: "Order Review", href: "order-review.html", icon: "✓" },
    { id: "queue", label: "Job Queue", href: "queue.html", icon: "≡" },
    { id: "history", label: "History", href: "history.html", icon: "↺" },
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
        '<img class="brand-logo" src="assets/images/logo.svg" alt="">' +
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

    var toggle = document.querySelector("[data-nav-toggle]");

    if (toggle) {
      toggle.addEventListener("click", function () {
        var isOpen = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
      });
    }

    document.addEventListener("click", function (event) {
      if (window.innerWidth > 780) return;
      if (!document.body.classList.contains("nav-open")) return;
      if (event.target.closest("#sidebar") || event.target.closest("[data-nav-toggle]")) return;

      document.body.classList.remove("nav-open");

      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
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
    confirmAction: confirmAction
  };
})(window.PaPrint);
