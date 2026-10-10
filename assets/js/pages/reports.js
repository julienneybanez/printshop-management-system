document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "reports",
    title: "Reports"
  });

  var serviceBody = document.querySelector("[data-service-report-body]");
  var recentBody = document.querySelector("[data-recent-report-body]");
  var statusList = document.querySelector("[data-report-status-list]");
  var exportButton = document.querySelector("[data-export-report]");

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.textContent = String(value);
  }

  function countByStatus(orders, status) {
    return orders.filter(function (order) {
      return order.status === status;
    }).length;
  }

  function claimedRevenue(orders) {
    return orders
      .filter(function (order) {
        return order.status === "claimed";
      })
      .reduce(function (total, order) {
        return total + Number(order.pricing && order.pricing.total || 0);
      }, 0);
  }

  function serviceStats(orders) {
    var stats = {};

    PaPrint.config.services.forEach(function (service) {
      stats[service.id] = {
        name: service.name,
        orders: 0,
        completed: 0,
        revenue: 0
      };
    });

    orders.forEach(function (order) {
      var serviceId = order.service && order.service.id;
      var name = order.service && order.service.name || "Other";

      if (!stats[serviceId]) {
        stats[serviceId] = {
          name: name,
          orders: 0,
          completed: 0,
          revenue: 0
        };
      }

      stats[serviceId].orders += 1;

      if (order.status === "claimed") {
        stats[serviceId].completed += 1;
        stats[serviceId].revenue += Number(order.pricing && order.pricing.total || 0);
      }
    });

    return Object.keys(stats).map(function (key) {
      return stats[key];
    }).filter(function (item) {
      return item.orders > 0;
    }).sort(function (a, b) {
      if (b.orders !== a.orders) return b.orders - a.orders;
      return b.revenue - a.revenue;
    });
  }

  function renderServiceReport(stats) {
    if (!stats.length) {
      serviceBody.innerHTML =
        '<tr><td colspan="4"><div class="empty-state">No order data available yet.</div></td></tr>';
      return;
    }

    serviceBody.innerHTML = stats.map(function (item) {
      return (
        "<tr>" +
          "<td><strong>" + PaPrint.escapeHTML(item.name) + "</strong></td>" +
          "<td>" + item.orders + "</td>" +
          "<td>" + item.completed + "</td>" +
          "<td>" + PaPrint.escapeHTML(PaPrint.formatMoney(item.revenue)) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function renderStatusReport(orders) {
    var statuses = ["received", "printing", "finishing", "ready", "claimed", "cancelled"];

    statusList.innerHTML = statuses.map(function (status) {
      return (
        '<div class="report-status-row">' +
          '<span><span class="badge ' + PaPrint.statusClass(status) + '">' +
            PaPrint.escapeHTML(PaPrint.statusLabel(status)) +
          "</span></span>" +
          "<strong>" + countByStatus(orders, status) + "</strong>" +
        "</div>"
      );
    }).join("");
  }

  function renderRecentCompleted(orders) {
    var completed = orders
      .filter(function (order) {
        return order.status === "claimed";
      })
      .slice()
      .sort(function (a, b) {
        return new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime();
      })
      .slice(0, 8);

    if (!completed.length) {
      recentBody.innerHTML =
        '<tr><td colspan="5"><div class="empty-state">No completed jobs yet.</div></td></tr>';
      return;
    }

    recentBody.innerHTML = completed.map(function (order) {
      return (
        "<tr>" +
          '<td><a href="job-details.html?id=' + encodeURIComponent(order.id) + '"><strong>' +
            PaPrint.escapeHTML(order.queueNumber) +
          "</strong></a></td>" +
          "<td>" + PaPrint.escapeHTML(order.customer && order.customer.name || "Walk-in") + "</td>" +
          "<td>" + PaPrint.escapeHTML(order.service && order.service.name || "Print Service") + "</td>" +
          "<td>" + PaPrint.escapeHTML(PaPrint.formatDate(order.updatedAt || order.createdAt)) + "</td>" +
          "<td>" + PaPrint.escapeHTML(PaPrint.formatMoney(order.pricing && order.pricing.total)) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function render() {
    var orders = PaPrint.storage.getOrders();
    var active = PaPrint.getActiveOrders(orders);
    var completed = countByStatus(orders, "claimed");
    var cancelled = countByStatus(orders, "cancelled");
    var rush = orders.filter(function (order) {
      return Boolean(order.specifications && order.specifications.rush);
    }).length;
    var revenue = claimedRevenue(orders);
    var stats = serviceStats(orders);
    var average = completed ? revenue / completed : 0;

    setText("[data-report-total-jobs]", orders.length);
    setText("[data-report-completed]", completed);
    setText("[data-report-revenue]", PaPrint.formatMoney(revenue));
    setText("[data-report-rush]", rush);
    setText("[data-report-cancelled]", cancelled);
    setText("[data-report-active]", active.length);
    setText("[data-report-average]", PaPrint.formatMoney(average));
    setText("[data-report-top-service]", stats.length ? stats[0].name : "—");

    renderServiceReport(stats);
    renderStatusReport(orders);
    renderRecentCompleted(orders);
  }

  function csvEscape(value) {
    var text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var orders = PaPrint.storage.getOrders();

    if (!orders.length) {
      PaPrint.ui.toast("There are no orders to export yet.");
      return;
    }

    var rows = [
      ["Queue Number", "Customer", "Contact", "Service", "Status", "Rush", "Created", "Updated", "Total", "Priority", "Deadline", "Pickup Slot"]
    ];

    orders.forEach(function (order) {
      rows.push([
        order.queueNumber,
        order.customer && order.customer.name || "Walk-in",
        order.customer && order.customer.contact || "",
        order.service && order.service.name || "Print Service",
        PaPrint.statusLabel(order.status),
        order.specifications && order.specifications.rush ? "Yes" : "No",
        order.createdAt || "",
        order.updatedAt || "",
        Number(order.pricing && order.pricing.total || 0).toFixed(2),
        order.priority || "normal", order.deadline || "", order.pickupSlot || ""
      ]);
    });

    var csv = rows.map(function (row) {
      return row.map(csvEscape).join(",");
    }).join("\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "paprint-orders-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    PaPrint.ui.toast("Report exported as CSV.");
  }

  exportButton.addEventListener("click", exportCsv);

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });

  window.addEventListener("focus", render);

  render();
});
