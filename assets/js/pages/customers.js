document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  PaPrint.ui.initShell({ activePage: "customers", title: "Customers" });
  var form = document.querySelector("#customerForm");
  var search = document.querySelector("#customerSearch");
  var rows = document.querySelector("#customerRows");
  var panel = document.querySelector("#customerOrdersPanel");
  var panelTitle = document.querySelector("#customerOrdersTitle");
  var panelContent = document.querySelector("#customerOrdersContent");
  function ordersFor(customer) {
    return PaPrint.storage.getOrders().filter(function (o) {
      var c = o.customer || {};
      return c.customerId === customer.id || (!c.customerId && !!customer.contact && c.contact === customer.contact);
    });
  }
  function render() {
    var term = search.value.toLowerCase().trim();
    var customers = PaPrint.storage.getCustomers().filter(function (c) {
      return (c.name + " " + (c.contact || "")).toLowerCase().includes(term);
    });
    rows.innerHTML = customers.map(function (c) {
      var orders = ordersFor(c);
      var total = orders.filter(function (o) { return o.status !== "cancelled"; }).reduce(function (n,o) {
        return n + Number(o.pricing && o.pricing.total || 0);
      }, 0);
      return "<tr><td>" + PaPrint.escapeHTML(c.name) + "</td><td>" +
        PaPrint.escapeHTML(c.contact || "Not provided") + "</td><td>" + orders.length +
        "</td><td>" + PaPrint.escapeHTML(PaPrint.formatMoney(total)) +
        '</td><td><button class="btn btn-neutral btn-sm" data-view-customer="' + PaPrint.escapeHTML(c.id) + '" type="button">View orders</button></td></tr>';
    }).join("") || '<tr><td colspan="5" class="empty-state">No matching customers.</td></tr>';
  }
  function viewCustomer(id) {
    var customer = PaPrint.storage.getCustomers().find(function (c) { return c.id === id; });
    if (!customer) return;
    var orders = ordersFor(customer).sort(function (a,b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    panelTitle.textContent = customer.name + " · Previous orders";
    panelContent.innerHTML = orders.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Queue</th><th>Service</th><th>Created</th><th>Status</th><th>Total</th><th>Open</th></tr></thead><tbody>' +
      orders.map(function (o) { return '<tr><td>' + PaPrint.escapeHTML(o.queueNumber) + '</td><td>' + PaPrint.escapeHTML(o.service && o.service.name || "Print Service") + '</td><td>' + PaPrint.escapeHTML(PaPrint.formatDate(o.createdAt)) + '</td><td>' + PaPrint.escapeHTML(PaPrint.statusLabel(o.status)) + '</td><td>' + PaPrint.escapeHTML(PaPrint.formatMoney(o.pricing && o.pricing.total)) + '</td><td><a class="btn btn-neutral btn-sm" href="job-details.html?id=' + encodeURIComponent(o.id) + '">Job details</a></td></tr>'; }).join("") + '</tbody></table></div>' : '<p class="muted">No previous orders for this customer yet.</p>';
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.querySelector("#customerName").value.trim();
    var contact = document.querySelector("#customerContact").value.trim();
    if (!name) return;
    var duplicates = PaPrint.storage.getCustomers().filter(function (c) { return c.name.toLowerCase() === name.toLowerCase(); });
    if (duplicates.length) PaPrint.ui.toast("A customer with this name exists. A separate record was created; use Existing Customer for repeat orders.");
    PaPrint.storage.upsertCustomer({ name: name, contact: contact });
    form.reset(); render();
    if (!duplicates.length) PaPrint.ui.toast("Customer saved.");
  });
  rows.addEventListener("click", function (event) {
    var button = event.target.closest("[data-view-customer]");
    if (button) viewCustomer(button.dataset.viewCustomer);
  });
  document.querySelector("#closeCustomerOrders").addEventListener("click", function () { panel.hidden = true; });
  search.addEventListener("input", render);
  window.addEventListener("focus", render);
  render();
});
