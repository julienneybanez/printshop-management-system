document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "dashboard",
    title: "Dashboard"
  });

  var queueHost = document.querySelector("[data-dashboard-queue]");

  function countByStatus(orders, status) {
    return orders.filter(function (order) {
      return order.status === status;
    }).length;
  }

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.textContent = String(value);
  }

  function renderQueue(activeOrders) {
    var orders = PaPrint.sortQueueOrders(activeOrders).slice(0, 7);

    if (!orders.length) {
      queueHost.innerHTML =
        '<div class="empty-state">' +
          '<h3>No active print jobs.</h3>' +
          '<p>Create a new job to start the queue.</p>' +
          '<a class="btn btn-primary btn-sm" href="new-job.html" style="margin-top:10px">Create New Job</a>' +
        "</div>";
      return;
    }

    queueHost.innerHTML = orders.map(function (order) {
      var rush = order.specifications && order.specifications.rush;
      var customerName = order.customer && order.customer.name || "Walk-in";
      var serviceName = order.service && order.service.name || "Print Service";

      return (
        '<a class="dashboard-job" href="queue.html?focus=' + encodeURIComponent(order.id) + '">' +
          '<div class="dashboard-job-queue">' +
            "<strong>" + PaPrint.escapeHTML(order.queueNumber) + "</strong>" +
            (rush ? '<span class="rush-mark">Rush</span>' : "") +
          "</div>" +
          '<div class="dashboard-job-main">' +
            "<strong>" + PaPrint.escapeHTML(customerName) + "</strong>" +
            "<small>" + PaPrint.escapeHTML(PaPrint.orderShortSummary(order)) + "</small>" +
          "</div>" +
          '<div class="dashboard-job-service">' +
            "<strong>" + PaPrint.escapeHTML(serviceName) + "</strong>" +
            "<small>" + PaPrint.escapeHTML(PaPrint.formatDate(order.createdAt)) + "</small>" +
          "</div>" +
          '<span class="badge ' + PaPrint.statusClass(order.status) + '">' +
            PaPrint.escapeHTML(PaPrint.statusLabel(order.status)) +
          "</span>" +
        "</a>"
      );
    }).join("");
  }

  function render() {
    var orders = PaPrint.storage.getOrders();
    var activeOrders = PaPrint.getActiveOrders(orders);
    var received = countByStatus(activeOrders, "received");
    var printing = countByStatus(activeOrders, "printing");
    var finishing = countByStatus(activeOrders, "finishing");
    var ready = countByStatus(activeOrders, "ready");

    setText("[data-metric-active]", activeOrders.length);
    setText("[data-metric-received]", received);
    setText("[data-metric-progress]", printing + finishing);
    setText("[data-metric-ready]", ready);

    setText("[data-status-received]", received);
    setText("[data-status-printing]", printing);
    setText("[data-status-finishing]", finishing);
    setText("[data-status-ready]", ready);

    renderQueue(activeOrders);
  }

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });

  window.addEventListener("focus", render);

  render();
});
