document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({ activePage: "services", title: "Services" });

  var grid = document.querySelector("[data-service-grid]");
  var search = document.querySelector("#serviceSearch");
  var category = document.querySelector("#serviceCategory");

  function render() {
    var term = search.value.trim().toLowerCase();
    var selectedCategory = category.value;
    var services = PaPrint.config.services.filter(function (service) {
      var matchesTerm = !term ||
        (service.name + " " + service.description).toLowerCase().includes(term);
      var matchesCategory = selectedCategory === "all" ||
        service.category === selectedCategory;
      return matchesTerm && matchesCategory;
    });

    if (!services.length) {
      grid.innerHTML = '<div class="card empty-state"><h2>No services found.</h2></div>';
      return;
    }

    grid.innerHTML = services.map(function (service) {
      return (
        '<article class="card service-card">' +
          '<div class="service-icon" aria-hidden="true">' + PaPrint.escapeHTML(service.icon) + '</div>' +
          '<div><h2>' + PaPrint.escapeHTML(service.name) + '</h2>' +
          '<p>' + PaPrint.escapeHTML(service.description) + '</p></div>' +
          '<div class="service-price">Starts at ' +
            PaPrint.escapeHTML(PaPrint.formatMoney(PaPrint.pricing.startingPrice(service))) +
            ' per ' + PaPrint.escapeHTML(service.unit) + '</div>' +
          '<div class="service-actions">' +
            '<a class="btn btn-primary" href="new-job.html?service=' + encodeURIComponent(service.id) + '">Create Job</a>' +
            '<button class="btn btn-neutral" type="button" data-edit-rates="' +
              PaPrint.escapeHTML(service.id) + '">Edit Prices</button>' +
          '</div>' +
        '</article>'
      );
    }).join("");
  }

  function editRates(groupId) {
    var group = PaPrint.pricing.getGroup(groupId);
    if (!group) return;
    var prices = PaPrint.pricing.getRates()[groupId];
    var previousFocus = document.activeElement;
    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML =
      '<div class="modal pricing-modal" role="dialog" aria-modal="true" aria-labelledby="pricingModalTitle">' +
        '<h2 id="pricingModalTitle">Edit ' + PaPrint.escapeHTML(group.label) + ' prices</h2>' +
        '<p>Saved prices are used for new or edited jobs. Existing confirmed totals remain unchanged.</p>' +
        '<form id="pricingEditForm">' +
          '<div class="pricing-fields">' + group.fields.map(function (field) {
            return '<div class="field"><label for="pricing-' + PaPrint.escapeHTML(field.key) + '">' +
              PaPrint.escapeHTML(field.label) + '</label>' +
              '<div class="pricing-input-wrap"><span>₱</span><input class="input" type="number" ' +
              'id="pricing-' + PaPrint.escapeHTML(field.key) + '" data-rate="' + PaPrint.escapeHTML(field.key) +
              '" min="0" max="100000" step="0.01" required value="' + String(prices[field.key]) + '"></div></div>';
          }).join("") + '</div>' +
          '<div class="modal-actions pricing-modal-actions">' +
            '<button class="btn btn-neutral" type="button" data-reset-rates>Restore defaults</button>' +
            '<button class="btn btn-neutral" type="button" data-close-pricing>Cancel</button>' +
            '<button class="btn btn-primary" type="submit">Save prices</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    function close() {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") close();
    }
    document.body.appendChild(backdrop);
    document.addEventListener("keydown", onKeyDown);
    backdrop.querySelector("[data-close-pricing]").addEventListener("click", close);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) close();
    });

    backdrop.querySelector("#pricingEditForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var values = {};
      for (var i = 0; i < group.fields.length; i++) {
        var key = group.fields[i].key;
        var input = backdrop.querySelector('[data-rate="' + key + '"]');
        if (!input || input.value.trim() === "" || !input.reportValidity()) return;
        values[key] = input.value;
      }
      try {
        PaPrint.pricing.saveGroup(groupId, values);
        close();
        render();
        PaPrint.ui.toast("Shop prices updated. New jobs will use these rates.");
      } catch (error) {
        PaPrint.ui.toast(error.message || "Could not save prices.");
      }
    });
    backdrop.querySelector("[data-reset-rates]").addEventListener("click", async function () {
      var approved = await PaPrint.ui.confirmAction({
        title: "Restore default prices?",
        message: "Only " + group.label + " rates will return to their original values. Existing job totals will not change.",
        confirmText: "Restore defaults", cancelText: "Keep prices"
      });
      if (!approved) return;
      try {
        PaPrint.pricing.resetGroup(groupId);
        close();
        render();
        PaPrint.ui.toast("Default prices restored for " + group.label + ".");
      } catch (error) {
        PaPrint.ui.toast(error.message || "Could not restore prices.");
      }
    });
    var firstField = backdrop.querySelector("[data-rate]");
    if (firstField) firstField.focus();
  }

  grid.addEventListener("click", function (event) {
    var button = event.target.closest("[data-edit-rates]");
    if (button) editRates(button.getAttribute("data-edit-rates"));
  });
  document.querySelector("#editRushFee").addEventListener("click", function () {
    editRates("general");
  });
  search.addEventListener("input", render);
  category.addEventListener("change", render);
  window.addEventListener("storage", function (event) {
    if (event.key === "paprint_v1_pricing_rates") render();
  });

  render();
});
