document.addEventListener("DOMContentLoaded",function(){
  PaPrint.ui.initShell({activePage:"history",title:"Order Receipt"});
  var id=new URLSearchParams(location.search).get("id");
  var o=PaPrint.storage.getOrders().find(function(x){return x.id===id;});
  var host=document.querySelector("#receiptContent");
  document.querySelector("#printReceipt").addEventListener("click",function(){if(o)window.print();});
  if(!o){host.textContent="Order not found.";return;}
  var entries=[ ["Reference",o.queueNumber],["Customer",o.customer&&o.customer.name],["Contact",o.customer&&o.customer.contact],["Service",o.service&&o.service.name],["Created",PaPrint.formatDate(o.createdAt)],["Status",PaPrint.statusLabel(o.status)],["Priority",o.priority||"normal"],["Pickup slot",o.pickupSlot||"Not specified"],["Total",PaPrint.formatMoney(o.pricing&&o.pricing.total)] ];
  host.innerHTML="<h2>PaPrint — Order Summary</h2><dl>"+entries.map(function(row){return "<dt>"+PaPrint.escapeHTML(row[0])+"</dt><dd>"+PaPrint.escapeHTML(row[1]||"—")+"</dd>";}).join("")+"</dl><p>Reference code identifies this order only. Payment has not been verified.</p>";
});