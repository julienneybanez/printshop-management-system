document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "queue",
    title: "Job Queue"
  });

  var list = document.querySelector("[data-queue-list]");
  var search = document.querySelector("#queueSearch");
  var statusSelect = document.querySelector("#queueStatus");
  var chips = Array.from(document.querySelectorAll("[data-queue-filter]"));
  var serviceFilter = document.querySelector("#queueService"), priorityFilter = document.querySelector("#queuePriority");
  var fromFilter = document.querySelector("#queueFrom"), toFilter = document.querySelector("#queueTo");
  PaPrint.config.services.forEach(function(service) { var option = document.createElement("option"); option.value=service.id; option.textContent=service.name; serviceFilter.appendChild(option); });
  var createdNotice = document.querySelector("[data-created-notice]");
  var params = new URLSearchParams(window.location.search);
  var createdQueue = params.get("created");
  var focusId = params.get("focus");
  var currentStatus = "all";

  function showCreatedNotice() {
    if (!createdQueue || !createdNotice) return;

    createdNotice.hidden = false;
    createdNotice.textContent =
      "Order " + createdQueue + " was added to the job queue successfully.";
  }

  function updateChipState() {
    chips.forEach(function (chip) {
      var isActive = chip.getAttribute("data-queue-filter") === currentStatus;
      chip.classList.toggle("active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function matchesSearch(order, term) {
    if (!term) return true;

    var haystack = [
      order.queueNumber,
      order.customer && order.customer.name,
      order.customer && order.customer.contact,
      order.service && order.service.name,
      PaPrint.orderShortSummary(order)
    ].join(" ").toLowerCase();

    return haystack.includes(term);
  }

  function nextActionLabel(order) {
    var next = PaPrint.nextStatus(order);

    var labels = {
      printing: "Start Printing",
      finishing: "Start Finishing",
      ready: "Mark Ready",
      claimed: "Mark Claimed"
    };

    return next ? labels[next] || ("Move to " + PaPrint.statusLabel(next)) : "";
  }

  function render() {
    var term = search.value.trim().toLowerCase();
    var activeOrders = PaPrint.sortQueueOrders(
      PaPrint.getActiveOrders(PaPrint.storage.getOrders())
    );

    activeOrders.sort(function(a,b) {
      var ranks = {rush: 3, high:2, normal:1};
      var prA = ranks[a.priority || (a.specifications && a.specifications.rush ? "rush":"normal")] || 1;
      var prB = ranks[b.priority || (b.specifications && b.specifications.rush ? "rush":"normal")] || 1;
      return prB-prA || (new Date(a.deadline || "9999-12-31")-new Date(b.deadline || "9999-12-31"));
    });
    var orders = activeOrders.filter(function (order) {
      var statusMatch = currentStatus === "all" || order.status === currentStatus;
      var day = String(order.createdAt || "").slice(0,10);
      return statusMatch && matchesSearch(order, term) &&
        (serviceFilter.value === "all" || order.service && order.service.id === serviceFilter.value) &&
        (priorityFilter.value === "all" || (order.priority || (order.specifications && order.specifications.rush ? "rush":"normal")) === priorityFilter.value) &&
        (!fromFilter.value || day >= fromFilter.value) && (!toFilter.value || day <= toFilter.value);
    });

    if (!orders.length) {
      list.innerHTML =
        '<div class="empty-state queue-empty">' +
          '<h2>No matching active jobs.</h2>' +
          '<p>Try another filter or create a new print job.</p>' +
        "</div>";
      return;
    }

    list.innerHTML = orders.map(function (order) {
      var rush = order.specifications && order.specifications.rush;
      var nextStatus = PaPrint.nextStatus(order);
      var customerName = order.customer && order.customer.name || "Walk-in";
      var contact = order.customer && order.customer.contact || "No contact";
      var serviceName = order.service && order.service.name || "Print Service";
      var focused = focusId && focusId === order.id ? " queue-row-focus" : "";

      return (
        '<article class="queue-row' + focused + '" data-order-id="' + PaPrint.escapeHTML(order.id) + '">' +
          '<div class="queue-number-line">' +
            "<strong>" + PaPrint.escapeHTML(order.queueNumber) + "</strong>" +
            (rush || order.priority === "rush" ? '<span class="queue-rush">Rush</span>' : order.priority === "high" ? '<span class="queue-rush">High</span>' : "") +
            (order.deadline && new Date(order.deadline).getTime() < Date.now() ? '<span class="queue-rush">Overdue</span>' : "") +
          "</div>" +

          '<div class="queue-main">' +
            "<strong>" + PaPrint.escapeHTML(customerName) + "</strong>" +
            "<small>" + PaPrint.escapeHTML(contact) + "</small>" +
          "</div>" +

          '<div class="queue-service">' +
            "<strong>" + PaPrint.escapeHTML(serviceName) + "</strong>" +
            "<small>" + PaPrint.escapeHTML(PaPrint.orderShortSummary(order)) + "</small>" +
          "</div>" +

          '<div class="queue-time">' +
            '<span class="badge ' + PaPrint.statusClass(order.status) + '">' +
              PaPrint.escapeHTML(PaPrint.statusLabel(order.status)) +
            "</span>" +
            "<small>" + PaPrint.escapeHTML(PaPrint.formatDate(order.createdAt)) + "</small>" +
            (order.deadline ? "<small>Due: " + PaPrint.escapeHTML(order.deadline.replace("T", " ")) + "</small>" : "") +
          "</div>" +

          '<div class="queue-actions">' +
            '<a class="btn btn-neutral btn-sm" href="job-details.html?id=' +
              encodeURIComponent(order.id) +
            '">View Details</a>' +
            (nextStatus
              ? '<button class="btn btn-primary btn-sm" type="button" data-next-status="' +
                  PaPrint.escapeHTML(nextStatus) + '">' +
                  PaPrint.escapeHTML(nextActionLabel(order)) +
                "</button>"
              : "") +
            (PaPrint.storage.canCancel(order) ? '<button class="btn btn-danger btn-sm" type="button" data-cancel-order>Cancel</button>' : "") +
          "</div>" +
        "</article>"
      );
    }).join("");

    if (focusId) {
      var focusedRow = list.querySelector('[data-order-id="' + CSS.escape(focusId) + '"]');
      if (focusedRow) {
        focusedRow.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }

  function setStatusFilter(status) {
    currentStatus = status;
    statusSelect.value = status;
    updateChipState();
    render();
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      setStatusFilter(chip.getAttribute("data-queue-filter"));
    });
  });

  statusSelect.addEventListener("change", function () {
    setStatusFilter(statusSelect.value);
  });

  search.addEventListener("input", render);
  [serviceFilter,priorityFilter,fromFilter,toFilter].forEach(function(field) { field.addEventListener("change", render); });
  document.querySelector("#queueReset").addEventListener("click",function(){ search.value=""; serviceFilter.value="all"; priorityFilter.value="all"; fromFilter.value=""; toFilter.value=""; setStatusFilter("all"); });

  list.addEventListener("click", async function (event) {
    var row = event.target.closest("[data-order-id]");
    if (!row) return;

    var orderId = row.getAttribute("data-order-id");
    var nextButton = event.target.closest("[data-next-status]");
    var cancelButton = event.target.closest("[data-cancel-order]");

    if (nextButton) {
      var nextStatus = nextButton.getAttribute("data-next-status");
      var updated = PaPrint.storage.updateStatus(orderId, nextStatus);

      if (updated) {
        PaPrint.ui.toast(
          updated.queueNumber + " marked as " + PaPrint.statusLabel(updated.status) + "."
        );
        render();
      }
      return;
    }

    if (cancelButton) {
      var order = PaPrint.storage.getOrders().find(function (item) {
        return item.id === orderId;
      });

      if (!order) return;

      var confirmed = await PaPrint.ui.confirmAction({
        title: "Cancel " + order.queueNumber + "?",
        message: "This will move the order out of the active queue and into History.",
        confirmText: "Cancel Order",
        cancelText: "Keep Order",
        danger: true
      });

      if (!confirmed) return;

      var cancelled = PaPrint.storage.updateStatus(orderId, "cancelled");

      if (cancelled) {
        PaPrint.ui.toast(cancelled.queueNumber + " was cancelled.");
        render();
      }
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });

  window.addEventListener("focus", render);

  showCreatedNotice();
  updateChipState();
  render();
});
