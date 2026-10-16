document.addEventListener("DOMContentLoaded",function(){
  PaPrint.ui.initCustomerShell("track");
  var input=document.querySelector("#trackingReference");var result=document.querySelector("#trackingResult");
  function show(){var reference=input.value.trim().toUpperCase();var request=PaPrint.storage.getRequests().find(function(r){return String(r.reference).toUpperCase()===reference;});result.hidden=false;
    if(!request){result.innerHTML='<h2>Request not found</h2><p>Check the reference number. Requests only exist in the browser where they were submitted.</p>';return;}
    var order=request.orderId&&PaPrint.storage.getOrders().find(function(o){return o.id===request.orderId;});
    var status=order?PaPrint.statusLabel(order.status):({pending:"Pending staff review",approved:"Approved",rejected:"Rejected",cancelled:"Cancelled"}[request.status]||request.status);
    result.innerHTML='<p class="step-label">'+PaPrint.escapeHTML(request.reference)+'</p><h2>'+PaPrint.escapeHTML(status)+'</h2><p>Service: '+PaPrint.escapeHTML(request.service&&request.service.name||"Print request")+'</p><p>Submitted: '+PaPrint.escapeHTML(PaPrint.formatDate(request.createdAt))+'</p>'+(order?'<p>Queue number: <strong>'+PaPrint.escapeHTML(order.queueNumber)+'</strong></p>':'')+'<h3>Activity timeline</h3>'+timelineMarkup(request,order)+(request.status==="pending"?'<button class="btn btn-danger" type="button" data-cancel-request="'+PaPrint.escapeHTML(request.id)+'">Cancel request</button>':'')+'<p class="helper">Updates appear when the staff changes the request or job status in this browser.</p>';
  }
  function timelineMarkup(request, order) {
    var events = Array.isArray(request.events) && request.events.length ? request.events.slice() :
      [{status:"pending",label:"Request submitted",timestamp:request.createdAt}];
    if (order) {
      (Array.isArray(order.statusHistory) ? order.statusHistory : []).forEach(function(event) {
        events.push({status:event.status,label:PaPrint.statusLabel(event.status),timestamp:event.timestamp});
      });
    }
    events.sort(function(a,b){return new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime();});
    return '<ol class="request-timeline">' + events.map(function(e){
      return '<li><strong>'+PaPrint.escapeHTML(e.label||e.status)+'</strong><small>'+PaPrint.escapeHTML(PaPrint.formatDate(e.timestamp))+'</small></li>';
    }).join("")+'</ol>';
  }
  result.addEventListener("click", async function(e){
    var b=e.target.closest("[data-cancel-request]");if(!b)return;
    var ok=await PaPrint.ui.confirmAction({title:"Cancel pending request?",message:"Cancelled requests cannot be approved or submitted again. You may create a new request.",confirmText:"Cancel request",cancelText:"Keep request",danger:true});
    if (!ok)return;
    if (PaPrint.storage.cancelRequest(b.dataset.cancelRequest)) {PaPrint.ui.toast("Request cancelled.");show();}
    else {PaPrint.ui.toast("This request can no longer be cancelled.");show();}
  });
  document.querySelector("#trackForm").addEventListener("submit",function(e){e.preventDefault();show();});
  input.value=new URLSearchParams(location.search).get("ref")||"";if(input.value)show();
  window.addEventListener("storage",function(){if(!result.hidden)show();});
});
