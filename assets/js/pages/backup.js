document.addEventListener("DOMContentLoaded", function(){
  PaPrint.ui.initShell({activePage:"backup",title:"Backup & Restore"});
  document.querySelector("#exportBackup").addEventListener("click",function(){
    var data={schema:"paprint-backup",version:1,exportedAt:new Date().toISOString(),orders:PaPrint.storage.getOrders(),customers:PaPrint.storage.getCustomers()};
    var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    var link=document.createElement("a");link.href=url;link.download="paprint-backup.json";document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  });
  document.querySelector("#restoreBackup").addEventListener("click",async function(){
    var input=document.querySelector("#restoreFile"),file=input.files[0];if(!file){PaPrint.ui.toast("Choose a backup file first.");return;}
    if(file.size>5*1024*1024){PaPrint.ui.toast("Backup must be under 5 MB.");return;}
    try{
      var data=JSON.parse(await file.text());
      if(data.schema!=="paprint-backup"||data.version!==1||!Array.isArray(data.orders)||!Array.isArray(data.customers))throw Error("Unsupported backup format.");
      if(!data.orders.every(function(o){return o&&typeof o.id==="string"&&typeof o.queueNumber==="string"&&o.customer&&typeof o.status==="string"&&PaPrint.config.statuses[o.status];}) || !data.customers.every(function(c){return c&&typeof c.id==="string"&&typeof c.name==="string"&&typeof c.contact==="string";}))throw Error("Invalid order or customer data.");
      var ok=await PaPrint.ui.confirmAction({title:"Replace local data?",message:"This will overwrite all saved orders and customers on this browser. Export a backup first.",confirmText:"Restore",cancelText:"Cancel",danger:true});
      if(!ok)return;
      var oldOrders=localStorage.getItem(PaPrint.config.storageKeys.orders),oldCustomers=localStorage.getItem("paprint_v1_customers");
      try{PaPrint.storage.saveOrders(data.orders);PaPrint.storage.saveCustomers(data.customers);}catch(e){if(oldOrders===null)localStorage.removeItem(PaPrint.config.storageKeys.orders);else localStorage.setItem(PaPrint.config.storageKeys.orders,oldOrders);if(oldCustomers===null)localStorage.removeItem("paprint_v1_customers");else localStorage.setItem("paprint_v1_customers",oldCustomers);throw e;}
      PaPrint.ui.toast("Backup restored. Reload pages to view the restored data.");
    }catch(error){PaPrint.ui.toast(error.message||"Could not read backup.");}
  });
});