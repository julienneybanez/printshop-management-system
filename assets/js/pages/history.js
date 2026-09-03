document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "history",
    title: "History"
  });

  var tbody = document.querySelector("[data-history-body]");
  var search = document.querySelector("#historySearch");
  var statusFilter = document.querySelector("#historyStatus");

  function render() {
    var orders = PaPrint.getArchivedOrders(PaPrint.storage.getOrders());
    var term = search.value.trim().toLowerCase();
    var status = statusFilter.value;

    orders = orders.filter(function (order) {
      var haystack = [
        order.queueNumber,
        order.customer && order.customer.name,
        order.service && order.service.name
      ].join(" ").toLowerCase();

      return (!term || haystack.includes(term)) &&
        (status === "all" || order.status === status);
    });

    orders.sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime();
    });

    if (!orders.length) {
      tbody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">No completed or cancelled orders yet.</div></td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(function (order) {
      return (
        "<tr>" +
          "<td><strong>" + PaPrint.escapeHTML(order.queueNumber) + "</strong></td>" +
          "<td>" + PaPrint.escapeHTML(order.customer && order.customer.name || "Walk-in") + "</td>" +
          "<td>" + PaPrint.escapeHTML(order.service && order.service.name || "Print Service") + "</td>" +
          "<td>" + PaPrint.escapeHTML(PaPrint.formatDate(order.createdAt)) + "</td>" +
          '<td><span class="badge ' + PaPrint.statusClass(order.status) + '">' +
            PaPrint.escapeHTML(PaPrint.statusLabel(order.status)) +
          "</span></td>" +
          "<td>" + PaPrint.escapeHTML(PaPrint.formatMoney(order.pricing && order.pricing.total)) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  search.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });

  render();
});
