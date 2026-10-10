document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "history",
    title: "History"
  });

  var tbody = document.querySelector("[data-history-body]");
  var search = document.querySelector("#historySearch");
  var statusFilter = document.querySelector("#historyStatus");

  var serviceFilter = document.querySelector("#historyService"), fromFilter = document.querySelector("#historyFrom"), toFilter = document.querySelector("#historyTo");
  PaPrint.config.services.forEach(function(s) { var opt = document.createElement("option"); opt.value=s.id; opt.textContent=s.name; serviceFilter.appendChild(opt); });
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

      var day = String(order.createdAt||"").slice(0,10);
      return (!term || haystack.includes(term)) && (status === "all" || order.status === status) &&
        (serviceFilter.value === "all" || order.service && order.service.id === serviceFilter.value) &&
        (!fromFilter.value || day >= fromFilter.value) && (!toFilter.value || day <= toFilter.value);
    });

    orders.sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime();
    });

    if (!orders.length) {
      tbody.innerHTML =
        '<tr><td colspan="7"><div class="empty-state">No completed or cancelled orders yet.</div></td></tr>';
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
          '<td><button type="button" class="btn btn-neutral btn-sm" data-reorder="'+PaPrint.escapeHTML(order.id)+'">Reorder</button> <a class="btn btn-neutral btn-sm" href="receipt.html?id='+encodeURIComponent(order.id)+'">Receipt</a></td>' +
        "</tr>"
      );
    }).join("");
  }

  search.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  [serviceFilter,fromFilter,toFilter].forEach(function(f){ f.addEventListener("change",render); });
  document.querySelector("#historyReset").addEventListener("click",function(){search.value=""; statusFilter.value="all";serviceFilter.value="all";fromFilter.value="";toFilter.value="";render();});
  tbody.addEventListener("click",function(e){
    var button=e.target.closest("[data-reorder]"); if(!button)return;
    var order=PaPrint.storage.getOrders().find(function(o){return o.id===button.dataset.reorder;}); if(!order)return;
    PaPrint.storage.saveDraft({customer:order.customer,service:order.service,specifications:order.specifications,pricing:order.pricing,priority:order.priority,deadline:"",pickupSlot:""});
    window.location.href="new-job.html?edit=1";
  });

  window.addEventListener("storage", function (event) {
    if (event.key === PaPrint.config.storageKeys.orders) {
      render();
    }
  });

  render();
});
