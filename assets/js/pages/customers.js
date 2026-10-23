document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  PaPrint.ui.initShell({activePage:"customers", title:"Customers"});
  try { PaPrint.storage.ensureRequestCustomerLinks(); }
  catch (error) { PaPrint.ui.toast("Some older requests could not be linked: " + error.message); }

  var search = document.querySelector("#customerSearch");
  var rows = document.querySelector("#customerRows");
  var panel = document.querySelector("#customerOrdersPanel");
  var panelTitle = document.querySelector("#customerOrdersTitle");
  var panelContent = document.querySelector("#customerOrdersContent");
  var manage = document.querySelector("#customerManagePanel");
  var detailId = null;
  var escape = PaPrint.escapeHTML;
  function findCustomer(id) {
    return PaPrint.storage.getCustomers().find(function (c) { return c.id === id; });
  }
  function ordersFor(id) {
    return PaPrint.storage.getOrders().filter(function (o) {
      return o.customer && o.customer.customerId === id;
    });
  }
  function requestsFor(id) {
    return PaPrint.storage.getRequests().filter(function (r) {
      return r.customer && r.customer.customerId === id;
    });
  }
  function matchesSearch(c, term) {
    var names = [c.name].concat(c.aliases || []);
    return names.concat(c.contact || "", c.id).join(" ").toLowerCase().includes(term);
  }
  function render() {
    var term = search.value.trim().toLowerCase();
    var customers = PaPrint.storage.getCustomers().filter(function (c) { return matchesSearch(c, term); });
    rows.innerHTML = customers.map(function (c) {
      var orders = ordersFor(c.id), requests = requestsFor(c.id);
      var total = orders.filter(function (o) { return o.status !== "cancelled"; }).reduce(function (n,o) {
        return n + Number(o.pricing && o.pricing.total || 0);
      }, 0);
      var matches = PaPrint.storage.findCustomerCandidates({name:c.name,contact:c.contact,excludeId:c.id});
      return '<tr><td><strong>' + escape(c.name) + '</strong>' +
        ((c.aliases || []).length ? '<div class="muted customer-small">Also: ' + escape(c.aliases.join(", ")) + '</div>' : "") +
        '<div class="customer-small muted">' + escape(c.id.slice(-8)) + '</div>' +
        (matches.length ? '<span class="customer-potential">Possible matches: ' + matches.length + '</span>' : "") +
        '</td><td>' + escape(c.contact || "Not provided") + '</td><td>' + orders.length +
        ' <span class="muted customer-small">(' + requests.length + ' requests)</span></td>' +
        '<td>' + escape(PaPrint.formatMoney(total)) + '</td><td>' +
        '<div class="customer-actions"><button class="btn btn-neutral btn-sm" data-view="' + escape(c.id) + '">View</button>' +
        '<button class="btn btn-neutral btn-sm" data-alias="' + escape(c.id) + '">Alias</button>' +
        '<button class="btn btn-neutral btn-sm" data-merge="' + escape(c.id) + '">Merge</button></div></td></tr>';
    }).join("") || '<tr><td colspan="5" class="empty-state">No matching customers.</td></tr>';
    if (detailId && findCustomer(detailId) && !panel.hidden) showCustomer(detailId, false);
  }
  function showCustomer(id, scroll) {
    var customer = findCustomer(id);
    if (!customer) { panel.hidden = true; return; }
    detailId = id;
    var orders = ordersFor(id).sort(function (a,b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var requests = requestsFor(id).sort(function (a,b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    panelTitle.textContent = customer.name + " · Activity";
    var orderItems = orders.map(function (o) {
      return '<tr><td>' + escape(o.queueNumber) + '</td><td>' + escape(o.service && o.service.name || "Print Service") +
        '</td><td>' + escape(PaPrint.statusLabel(o.status)) + '</td><td><a href="job-details.html?id=' + encodeURIComponent(o.id) + '">View job</a></td></tr>';
    }).join("");
    var reqItems = requests.map(function (r) {
      return '<tr><td>' + escape(r.reference) + '</td><td>' + escape(r.service && r.service.name || "Printing") +
        '</td><td>' + escape(r.status) + '</td><td>' + escape(r.customer && r.customer.name || "-") + '</td></tr>';
    }).join("");
    panelContent.innerHTML = '<p class="muted">Customer ID: ' + escape(customer.id) +
      ' · Aliases: ' + escape((customer.aliases || []).join(", ") || "None") + '</p>' +
      '<h3>Print jobs (' + orders.length + ')</h3>' +
      (orders.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Queue</th><th>Service</th><th>Status</th><th>Action</th></tr></thead><tbody>' + orderItems + '</tbody></table></div>' : '<p class="muted">No approved print jobs yet.</p>') +
      '<h3>Customer requests (' + requests.length + ')</h3>' +
      (requests.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Submitted as</th></tr></thead><tbody>' + reqItems + '</tbody></table></div>' : '<p class="muted">No requests.</p>');
    panel.hidden = false;
    if (scroll) panel.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function showMerge(id) {
    var target = findCustomer(id);
    if (!target) return;
    var customers = PaPrint.storage.getCustomers().filter(function (c) { return c.id !== id; });
    if (!customers.length) { PaPrint.ui.toast("No other customer records to merge."); return; }
    var suggested = PaPrint.storage.findCustomerCandidates({name:target.name,contact:target.contact,excludeId:id});
    manage.hidden = false;
    manage.innerHTML = '<h3>Merge into ' + escape(target.name) + '</h3><p class="muted">Only merge after personally confirming the records belong to the same person. The record above will be kept.</p>' +
      (suggested.length ? '<p>Possible matches: ' + escape(suggested.map(function (c) { return c.name + " (" + c.matchReason + ")"; }).join(", ")) + '</p>' : '<p class="muted">No exact name or contact suggestions; you may still choose a verified match.</p>') +
      '<label for="mergeOther">Record to combine</label><select class="input" id="mergeOther">' + customers.map(function (c) {
        return '<option value="' + escape(c.id) + '">' + escape(c.name) + ' · ' + escape(c.contact || "No contact") + ' · ' + escape(c.id.slice(-8)) + '</option>';
      }).join("") + '</select><div id="mergeSummary" class="customer-merge-summary"></div>' +
      '<div class="customer-actions"><button class="btn btn-danger" id="confirmMerge" type="button">Review & merge</button>' +
      '<button class="btn btn-neutral" id="closeManage" type="button">Cancel</button></div>';
    function updatePreview() {
      var secondary = findCustomer(document.querySelector("#mergeOther").value);
      var numOrders = ordersFor(secondary.id).length, numRequests = requestsFor(secondary.id).length;
      document.querySelector("#mergeSummary").textContent = 'Keeping ' + target.name + ' (' + target.id.slice(-8) + '). Combining ' + secondary.name + ' (' + secondary.id.slice(-8) + ') with ' + numOrders + ' job(s) and ' + numRequests + ' request(s). Original submitted names will stay on transactions.';
    }
    document.querySelector("#mergeOther").addEventListener("change", updatePreview);
    updatePreview();
    document.querySelector("#closeManage").addEventListener("click", function(){manage.hidden=true;});
    document.querySelector("#confirmMerge").addEventListener("click", async function () {
      var secondary = findCustomer(document.querySelector("#mergeOther").value);
      if (!secondary) return;
      var yes = await PaPrint.ui.confirmAction({
        title:"Merge customer records?",
        message:"Only proceed if staff verified both records belong to the same person. Keep '" + target.name + "'; combine '" + secondary.name + "' and reassign its requests and jobs? Back up your data first.",
        confirmText:"Merge verified records",cancelText:"Cancel",danger:true
      });
      if (!yes) return;
      try { PaPrint.storage.mergeCustomers(target.id, secondary.id); manage.hidden=true; PaPrint.ui.toast("Customer records merged."); render(); showCustomer(target.id, false); }
      catch(error) { PaPrint.ui.toast(error.message); }
    });
    manage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  rows.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-view],[data-alias],[data-merge]");
    if (!button) return;
    if (button.dataset.view) showCustomer(button.dataset.view,true);
    if (button.dataset.merge) showMerge(button.dataset.merge);
    if (button.dataset.alias) {
      var c = findCustomer(button.dataset.alias);
      if (!c) return;
      manage.hidden = false;
      manage.innerHTML = '<h3>Add alias for ' + escape(c.name) + '</h3><p class="muted">Use a verified nickname or alternate name. Aliases make this record searchable.</p>' +
        '<label for="aliasValue">Alternate name</label><input class="input" id="aliasValue" maxlength="100" required>' +
        '<div class="customer-actions"><button type="button" class="btn btn-primary" id="saveAlias">Save alias</button><button type="button" class="btn btn-neutral" id="cancelAlias">Cancel</button></div>';
      document.querySelector("#cancelAlias").addEventListener("click",function(){manage.hidden=true;});
      document.querySelector("#saveAlias").addEventListener("click",function(){
        try { PaPrint.storage.addCustomerAlias(c.id,document.querySelector("#aliasValue").value); manage.hidden=true; render(); PaPrint.ui.toast("Alias saved."); }
        catch(error){PaPrint.ui.toast(error.message);}
      });
      manage.scrollIntoView({behavior:"smooth",block:"nearest"});
    }
  });
  document.querySelector("#customerForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var name = document.querySelector("#customerName").value.trim();
    var contact = document.querySelector("#customerContact").value.trim();
    if (!name) return;
    var candidates = PaPrint.storage.findCustomerCandidates({name:name,contact:contact});
    if (candidates.length) {
      var yes = await PaPrint.ui.confirmAction({
        title:"Possible existing customer",
        message:"Found " + candidates.length + " matching name/contact record(s). Only create another profile if this is a different person or their identity is not confirmed.",
        confirmText:"Create separate profile",cancelText:"Check records first"
      });
      if (!yes) {search.value=name;render();return;}
    }
    try { PaPrint.storage.createCustomer({name:name,contact:contact,source:"staff"}); document.querySelector("#customerForm").reset(); render(); PaPrint.ui.toast("Customer saved."); }
    catch(error) { PaPrint.ui.toast(error.message); }
  });
  document.querySelector("#closeCustomerOrders").addEventListener("click",function(){panel.hidden=true;detailId=null;});
  search.addEventListener("input",render);
  window.addEventListener("focus",render);
  render();
});
