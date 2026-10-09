document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "queue",
    title: "Job Details"
  });

  var host = document.querySelector("[data-job-details-host]");
  var title = document.querySelector("[data-job-title]");
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("id");

  function findOrder() {
    return PaPrint.storage.getOrders().find(function (order) {
      return order.id === orderId;
    }) || null;
  }

  function priceRow(label, value, className) {
    return (
      '<div class="summary-row">' +
        "<span>" + PaPrint.escapeHTML(label) + "</span>" +
        '<strong class="' + (className || "") + '">' +
          PaPrint.escapeHTML(PaPrint.formatMoney(value)) +
        "</strong>" +
      "</div>"
    );
  }

  function renderStatusHistory(order) {
    var history = Array.isArray(order.statusHistory) ? order.statusHistory : [];

    if (!history.length) {
      return '<div class="empty-state">No status history available.</div>';
    }

    return history.map(function (entry) {
      return (
        '<div class="status-history-item">' +
          '<span class="status-history-dot" aria-hidden="true"></span>' +
          '<div class="status-history-content">' +
            '<strong>' + PaPrint.escapeHTML(PaPrint.statusLabel(entry.status)) + "</strong>" +
            '<small>' + PaPrint.escapeHTML(PaPrint.formatDate(entry.timestamp)) + "</small>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function render() {
    var order = findOrder();

    if (!order) {
      title.textContent = "Job not found";
      host.innerHTML =
        '<section class="card empty-state">' +
          "<h2>We could not find this print job.</h2>" +
          "<p>The order may have been removed or the link may be incomplete.</p>" +
          '<a class="btn btn-primary" href="queue.html" style="margin-top:12px">Return to Job Queue</a>' +
        "</section>";
      return;
    }

    title.textContent = order.queueNumber + " • " + (order.service && order.service.name || "Print Job");

    var customerName = order.customer && order.customer.name || "Walk-in";
    var contact = order.customer && order.customer.contact || "No contact";
    var pricing = order.pricing || {};
    var specifications = PaPrint.specificationRows(order);
    var notes = order.specifications && order.specifications.notes;
    var isActive = !["claimed", "cancelled"].includes(order.status);

    host.innerHTML =
      '<div class="job-details-layout">' +
        '<div class="job-details-main">' +
          '<section class="card card-pad">' +
            '<div class="section-heading"><h2>Order summary</h2>' +
              '<span class="badge ' + PaPrint.statusClass(order.status) + '">' +
                PaPrint.escapeHTML(PaPrint.statusLabel(order.status)) +
              "</span>" +
            "</div>" +
            '<div class="job-summary-grid">' +
              '<div class="job-summary-item"><span>Queue number</span><strong>' +
                PaPrint.escapeHTML(order.queueNumber) +
              "</strong></div>" +
              '<div class="job-summary-item"><span>Customer</span><strong>' +
                PaPrint.escapeHTML(customerName) +
              "</strong></div>" +
              '<div class="job-summary-item"><span>Contact</span><strong>' +
                PaPrint.escapeHTML(contact) +
              "</strong></div>" +
              '<div class="job-summary-item"><span>Created</span><strong>' +
                PaPrint.escapeHTML(PaPrint.formatDate(order.createdAt)) +
              "</strong></div>" +
              '<div class="job-summary-item"><span>Last updated</span><strong>' +
                PaPrint.escapeHTML(PaPrint.formatDate(order.updatedAt)) +
              "</strong></div>" +
              '<div class="job-summary-item"><span>Priority</span><strong>' +
                ((order.specifications && order.specifications.rush) ? "Rush" : "Standard") +
              "</strong></div>" +
            "</div>" +
          "</section>" +

          '<section class="card card-pad">' +
            '<div class="section-heading"><h2>Print specifications</h2></div>' +
            '<div class="spec-list">' +
              specifications.map(function (row) {
                return (
                  '<div class="spec-row">' +
                    "<span>" + PaPrint.escapeHTML(row[0]) + "</span>" +
                    "<strong>" + PaPrint.escapeHTML(row[1]) + "</strong>" +
                  "</div>"
                );
              }).join("") +
            "</div>" +
          "</section>" +

          (notes
            ? '<section class="card card-pad">' +
                '<div class="section-heading"><h2>Notes</h2></div>' +
                '<p class="job-note">' + PaPrint.escapeHTML(notes) + "</p>" +
              "</section>"
            : "") +
        "</div>" +

        '<aside class="job-details-side">' +
          '<section class="card card-pad">' +
            '<div class="section-heading"><h2>Pricing</h2></div>' +
            priceRow("Service", pricing.basePrice || 0) +
            priceRow("Finishing", pricing.finishingFee || 0) +
            priceRow("Rush fee", pricing.rushFee || 0) +
            priceRow("Total", pricing.total || 0, "job-price-total") +
          "</section>" +

          '<section class="card card-pad">' +
            '<div class="section-heading"><h2>Status history</h2></div>' +
            '<div class="status-history">' + renderStatusHistory(order) + "</div>" +
          "</section>" +

          '<section class="card card-pad job-details-actions">' +
            (isActive
              ? '<a class="btn btn-primary" href="queue.html?focus=' +
                  encodeURIComponent(order.id) +
                '">Manage in Queue</a>'
              : '<a class="btn btn-primary" href="history.html">View History</a>') +
            '<a class="btn btn-neutral" href="new-job.html?service=' +
              encodeURIComponent(order.service && order.service.id || "") +
            '">Create Similar Job</a>' +
          "</section>" +
        "</aside>" +
      "</div>";
  }

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });

  window.addEventListener("focus", render);

  render();
});
