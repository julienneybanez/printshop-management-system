document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var current = document.querySelector("[data-now-serving]");
  var list = document.querySelector("[data-public-list]");
  var clock = document.querySelector("[data-clock]");

  function render() {
    var active = PaPrint.sortQueueOrders(
      PaPrint.getActiveOrders(PaPrint.storage.getOrders())
    );

    var nowServing =
      active.find(function (order) {
        return ["printing", "finishing"].includes(order.status);
      }) ||
      active.find(function (order) {
        return order.status === "ready";
      }) ||
      active[0];

    if (!nowServing) {
      current.innerHTML =
        '<div class="empty-state"><h2>No active print jobs.</h2></div>';
    } else {
      current.innerHTML =
        '<div class="now-serving-label">Now serving</div>' +
        '<div class="queue-big">' + PaPrint.escapeHTML(nowServing.queueNumber) + "</div>" +
        '<div class="service-big">' + PaPrint.escapeHTML(nowServing.service && nowServing.service.name) + "</div>" +
        '<div class="status-big"><span class="badge ' +
          PaPrint.statusClass(nowServing.status) +
        '">' +
          PaPrint.escapeHTML(PaPrint.statusLabel(nowServing.status)) +
        "</span></div>";
    }

    if (!active.length) {
      list.innerHTML =
        '<div class="empty-state">No active jobs.</div>';
    } else {
      list.innerHTML = active.map(function (order) {
        return (
          '<div class="public-list-row">' +
            "<strong>" + PaPrint.escapeHTML(order.queueNumber) + "</strong>" +
            "<div>" +
              "<strong>" + PaPrint.escapeHTML(order.service && order.service.name) + "</strong>" +
              '<div class="helper">' +
                (order.specifications && order.specifications.rush ? "Rush" : "Standard") +
              "</div>" +
            "</div>" +
            '<span class="badge ' + PaPrint.statusClass(order.status) + '">' +
              PaPrint.escapeHTML(PaPrint.statusLabel(order.status)) +
            "</span>" +
          "</div>"
        );
      }).join("");
    }

    clock.textContent = new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  }

  render();

  window.setInterval(render, 3000);

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });
});
