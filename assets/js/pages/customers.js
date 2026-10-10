document.addEventListener("DOMContentLoaded", function () {
  PaPrint.ui.initShell({ activePage: "customers", title: "Customers" });
  var form = document.querySelector("#customerForm"), search = document.querySelector("#customerSearch");
  function render() {
    var customers = PaPrint.storage.getCustomers();
    var orders = PaPrint.storage.getOrders();
    var term = search.value.toLowerCase().trim();
    document.querySelector("#customerRows").innerHTML = customers.filter(function (c) {
      return (c.name + " " + c.contact).toLowerCase().includes(term);
    }).map(function (c) {
      var matches = orders.filter(function (o) { return o.customer && (o.customer.customerId === c.id || (!o.customer.customerId && o.customer.contact === c.contact)); });
      var total = matches.filter(function (o) { return o.status !== "cancelled"; }).reduce(function (sum,o) { return sum + Number(o.pricing && o.pricing.total || 0); },0);
      return "<tr><td>"+PaPrint.escapeHTML(c.name)+"</td><td>"+PaPrint.escapeHTML(c.contact)+"</td><td>"+matches.length+"</td><td>"+PaPrint.escapeHTML(PaPrint.formatMoney(total))+"</td></tr>";
    }).join("") || '<tr><td colspan="4">No matching customers.</td></tr>';
  }
  form.addEventListener("submit", function(e) { e.preventDefault(); PaPrint.storage.upsertCustomer({ name:document.querySelector("#customerName").value, contact:document.querySelector("#customerContact").value }); form.reset(); render(); PaPrint.ui.toast("Customer saved."); });
  search.addEventListener("input", render); window.addEventListener("focus", render); render();
});