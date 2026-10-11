document.addEventListener("DOMContentLoaded", function () {
  PaPrint.ui.initShell({activePage:"requests",title:"Incoming Requests"});
  var host=document.querySelector("#incomingList");var filter=document.querySelector("#requestStatusFilter");
  function render(){
    var requests=PaPrint.storage.getRequests().filter(function(r){return filter.value==="all"||r.status===filter.value;});
    host.innerHTML=requests.map(function(r){var spec=r.specifications||{};return '<article class="card card-pad request-card"><div class="section-heading"><h2>'+PaPrint.escapeHTML(r.reference)+'</h2><span class="badge">'+PaPrint.escapeHTML(r.status)+'</span></div><p><strong>'+PaPrint.escapeHTML(r.customer&&r.customer.name||"Guest")+'</strong> · '+PaPrint.escapeHTML(r.service&&r.service.name||"Printing")+'</p><p class="muted">'+PaPrint.escapeHTML(r.fileName||"No attachment")+' · '+PaPrint.escapeHTML(String(spec.copies||1))+' copies · '+PaPrint.escapeHTML(spec.paperSize||"—")+' · '+PaPrint.escapeHTML(spec.colorMode||"bw")+'</p><p>'+PaPrint.escapeHTML(spec.notes||"No additional instructions")+'</p><div class="request-actions"><button class="btn btn-neutral btn-sm" data-document="'+PaPrint.escapeHTML(r.id)+'">View document</button>'+(r.status==="pending"?'<button class="btn btn-primary btn-sm" data-approve="'+PaPrint.escapeHTML(r.id)+'">Approve & queue</button><button class="btn btn-danger btn-sm" data-reject="'+PaPrint.escapeHTML(r.id)+'">Reject</button>':'')+'</div>'+(r.orderId?'<p class="helper">Linked queue order available in Job Queue</p>':'')+'</article>';}).join("")||'<section class="card empty-state"><h3>No matching requests</h3><p>Submitted requests from this browser will appear here.</p></section>';
  }
  filter.addEventListener("change",render);
  host.addEventListener("click",async function(e){
    var b=e.target.closest("[data-document],[data-approve],[data-reject]");if(!b)return;
    var id=b.dataset.document||b.dataset.approve||b.dataset.reject;
    var request=PaPrint.storage.getRequests().find(function(r){return r.id===id;});if(!request)return;
    if(b.dataset.document){
      try{var file=await PaPrint.files.get(id);if(!file){PaPrint.ui.toast("Attachment is missing from this browser.");return;}var url=URL.createObjectURL(file);var a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.download=request.fileName||"document";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},60000);}catch(err){PaPrint.ui.toast("Document could not be opened.");}return;
    }
    if(request.status!=="pending"){PaPrint.ui.toast("This request is no longer pending.");render();return;}
    if(b.dataset.reject){var ok=await PaPrint.ui.confirmAction({title:"Reject request?",message:"The customer will see this request as rejected.",confirmText:"Reject",danger:true});if(ok){if(!PaPrint.storage.updateRequest(id,{status:"rejected"}))PaPrint.ui.toast("Could not reject this request.");render();}return;}
    var yes=await PaPrint.ui.confirmAction({title:"Approve and queue?",message:"This creates a print order using the submitted specifications. Confirm its pricing before production.",confirmText:"Approve"});if(!yes)return;
    var service=request.service||PaPrint.config.services[0],spec=request.specifications||{};
    var draft={customer:{type:"named",name:request.customer&&request.customer.name||"Guest",contact:request.customer&&request.customer.contact||"",saveToRecords:false},service:service,specifications:{pages:1,copies:Number(spec.copies)||1,quantity:Number(spec.copies)||1,sets:Number(spec.copies)||1,paperSize:spec.paperSize||"A4",colorMode:spec.colorMode||"bw",printSides:"single",finishing:"none",rush:false,notes:spec.notes||""},priority:"normal",deadline:"",pickupSlot:""};
    try{draft.pricing=PaPrint.pricing.calculate(draft);var order=PaPrint.storage.addOrder(draft);PaPrint.storage.updateRequest(id,{status:"approved",orderId:order.id,queueNumber:order.queueNumber});render();PaPrint.ui.toast("Request added to Job Queue. Confirm pricing before printing.");}catch(err){PaPrint.ui.toast(err.message||"Could not approve request.");}
  });
  window.addEventListener("storage",render);render();
});
