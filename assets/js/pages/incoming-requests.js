document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  PaPrint.ui.initShell({activePage:"requests",title:"Incoming Requests"});
  try { PaPrint.storage.ensureRequestCustomerLinks(); }
  catch (error) { PaPrint.ui.toast("Could not link older requests: " + error.message); }

  var host = document.querySelector("#incomingList");
  var filter = document.querySelector("#requestStatusFilter");
  var escape = PaPrint.escapeHTML;
  function getRequest(id) {return PaPrint.storage.getRequests().find(function (r) {return r.id === id;});}
  function customerCandidates(r) {
    return PaPrint.storage.findCustomerCandidates({
      name:r.customer && r.customer.name,
      contact:r.customer && r.customer.contact,
      excludeId:r.customer && r.customer.customerId
    });
  }
  function render() {
    var requests = PaPrint.storage.getRequests().filter(function (r) {
      return filter.value === "all" || r.status === filter.value;
    });
    host.innerHTML = requests.map(function (r) {
      var spec = r.specifications || {};
      var matches = customerCandidates(r);
      var statusClass = ["pending","approved","rejected","cancelled"].includes(r.status) ? r.status : "other";
      return '<article class="card card-pad request-card" data-request="' + escape(r.id) + '">' +
        '<div class="section-heading"><h2>' + escape(r.reference) + '</h2>' +
        '<span class="badge request-status request-status--' + statusClass + '">' + escape(r.status) + '</span></div>' +
        '<p><strong>' + escape(r.customer && r.customer.name || "Guest") + '</strong> · ' +
        escape(r.service && r.service.name || "Printing") + '</p>' +
        '<p class="muted">' + escape(r.fileName || "No attachment") + ' · ' + escape(String(spec.copies || 1)) +
        ' copies · ' + escape(spec.paperSize || "—") + ' · ' + escape(spec.colorMode || "bw") + '</p>' +
        '<p>' + escape(spec.notes || "No additional instructions") + '</p>' +
        '<p class="helper">Customer ID: ' + escape(r.customer && r.customer.customerId || "Unlinked") + '</p>' +
        (matches.length ? '<p class="request-match">Possible returning customer: ' + escape(matches.map(function(c){return c.name;}).join(", ")) + '. Verify before linking.</p>' : "") +
        '<div class="request-actions"><button class="btn btn-neutral btn-sm" data-document="' + escape(r.id) + '">View document</button>' +
        '<button class="btn btn-neutral btn-sm" data-link="' + escape(r.id) + '">Link to saved customer</button>' +
        (r.status === "pending" ? '<button class="btn btn-primary btn-sm" data-approve="' + escape(r.id) + '">Approve & queue</button>' +
          '<button class="btn btn-danger btn-sm" data-reject="' + escape(r.id) + '">Reject</button>' : "") +
        '</div>' + (r.orderId ? '<p class="helper">Linked queue order: ' + escape(r.queueNumber || "View in Job Queue") + '</p>' : "") +
        '</article>';
    }).join("") || '<section class="card empty-state"><h3>No matching requests</h3><p>Requests submitted from this browser appear here.</p></section>';
  }
  function showLinkPanel(request) {
    var candidates = customerCandidates(request);
    var customers = PaPrint.storage.getCustomers().filter(function (c) {
      return c.id !== (request.customer && request.customer.customerId);
    });
    if (!customers.length) { PaPrint.ui.toast("There are no other saved customer profiles."); return; }
    var overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.innerHTML = '<div class="modal request-link-modal" role="dialog" aria-modal="true" aria-labelledby="requestLinkTitle">' +
      '<h2 id="requestLinkTitle">Link a returning customer</h2><p>Confirm identity with the customer. Similar names and phone numbers do not prove identity.</p>' +
      (candidates.length ? '<p class="request-match">Possible matches: ' + escape(candidates.map(function (c) {return c.name + " (" + c.matchReason + ")";}).join(", ")) + '</p>' : "") +
      '<label for="requestCustomerPick">Choose customer profile</label><select id="requestCustomerPick" class="input">' + customers.map(function (c) {
        return '<option value="' + escape(c.id) + '">' + escape(c.name) + ' · ' + escape(c.contact || "No contact") + ' · ' + escape(c.id.slice(-8)) + '</option>';
      }).join("") + '</select>' +
      '<div class="modal-actions"><button type="button" class="btn btn-neutral" data-cancel-link>Cancel</button><button type="button" class="btn btn-primary" data-save-link>Link verified profile</button></div></div>';
    document.body.appendChild(overlay);
    var close = function(){overlay.remove();};
    overlay.querySelector("[data-cancel-link]").addEventListener("click",close);
    overlay.addEventListener("click",function(e){if(e.target===overlay)close();});
    overlay.querySelector("[data-save-link]").addEventListener("click", async function () {
      var chosen = overlay.querySelector("#requestCustomerPick").value;
      var name = customers.find(function(c){return c.id===chosen;});
      var okay = await PaPrint.ui.confirmAction({
        title:"Confirm customer identity",
        message:"Have you verified that this request belongs to " + name.name + "? The request and linked print job will use that customer record.",
        confirmText:"Link record",cancelText:"Back"
      });
      if(!okay)return;
      try { PaPrint.storage.linkRequestToCustomer(request.id,chosen);close();render();PaPrint.ui.toast("Request linked to saved customer."); }
      catch(error){PaPrint.ui.toast(error.message);}
    });
    overlay.querySelector("#requestCustomerPick").focus();
  }
  filter.addEventListener("change",render);
  host.addEventListener("click",async function(event){
    var button=event.target.closest("[data-document],[data-approve],[data-reject],[data-link]");
    if(!button)return;
    var id=button.dataset.document||button.dataset.approve||button.dataset.reject||button.dataset.link;
    var request=getRequest(id);if(!request)return;
    if(button.dataset.link){showLinkPanel(request);return;}
    if(button.dataset.document){
      try {
        var file=await PaPrint.files.get(id);
        if(!file){PaPrint.ui.toast("Attachment is missing from this browser (JSON backups do not include files).");return;}
        var url=URL.createObjectURL(file), a=document.createElement("a");
        a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.download=request.fileName||"document";
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(url);},60000);
      }catch(error){PaPrint.ui.toast("Document could not be opened.");}
      return;
    }
    if(request.status!=="pending"){PaPrint.ui.toast("This request is no longer pending.");render();return;}
    if(button.dataset.reject){
      var reject=await PaPrint.ui.confirmAction({title:"Reject request?",message:"The customer will see this request as rejected.",confirmText:"Reject",danger:true});
      if(reject){if(!PaPrint.storage.updateRequest(id,{status:"rejected"}))PaPrint.ui.toast("Could not reject request.");render();}
      return;
    }
    var approve=await PaPrint.ui.confirmAction({title:"Approve and queue?",message:"This creates a print order from the submitted specifications. Check pricing before production.",confirmText:"Approve"});
    if(!approve)return;
    var service=request.service||PaPrint.config.services[0],spec=request.specifications||{};
    var draft={
      customer:{type:"named",name:request.customer&&request.customer.name||"Guest",contact:request.customer&&request.customer.contact||"",
        customerId:request.customer&&request.customer.customerId||null,saveToRecords:false},
      service:service,
      specifications:{pages:1,copies:Number(spec.copies)||1,quantity:Number(spec.copies)||1,sets:Number(spec.copies)||1,
        paperSize:spec.paperSize||"A4",colorMode:spec.colorMode||"bw",printSides:"single",finishing:"none",rush:false,notes:spec.notes||""},
      priority:"normal",deadline:"",pickupSlot:""
    };
    var originalOrders=PaPrint.storage.getOrders();
    try {
      draft.pricing=PaPrint.pricing.calculate(draft);
      var order=PaPrint.storage.addOrder(draft);
      var updated=PaPrint.storage.updateRequest(id,{status:"approved",orderId:order.id,queueNumber:order.queueNumber});
      if(!updated)throw new Error("Request could not be approved.");
      render();PaPrint.ui.toast("Request added to Job Queue. Confirm pricing before printing.");
    }catch(error){
      try{PaPrint.storage.saveOrders(originalOrders);}catch(restoreError){console.error(restoreError);}
      PaPrint.ui.toast(error.message||"Could not approve request.");
    }
  });
  window.addEventListener("storage",render);
  render();
});
