document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  PaPrint.ui.initShell({activePage:"backup",title:"Backup & Restore"});
  var input=document.querySelector("#restoreFile");
  var preview=document.querySelector("#backupPreview");
  var message=document.querySelector("#backupMessage");
  var restore=document.querySelector("#restoreBackup");
  var selected=null;
  var maxFileSize=5*1024*1024;
  var customerKey="paprint_v1_customers";
  var requestKey="paprint_v1_requests";

  function isObject(value){return value!==null&&typeof value==="object"&&!Array.isArray(value);}
  function validOrder(o){
    return isObject(o)&&typeof o.id==="string"&&!!o.id.trim()&&typeof o.queueNumber==="string"&&
      typeof o.status==="string"&&Object.prototype.hasOwnProperty.call(PaPrint.config.statuses,o.status)&&
      isObject(o.service)&&typeof o.service.id==="string"&&isObject(o.specifications)&&isObject(o.pricing)&&
      Number.isFinite(Number(o.pricing.total))&&(o.customer==null||isObject(o.customer));
  }
  function validCustomer(c){
    return isObject(c)&&typeof c.id==="string"&&!!c.id.trim()&&typeof c.name==="string"&&!!c.name.trim()&&
      (c.contact==null||typeof c.contact==="string")&&
      (c.aliases==null||(Array.isArray(c.aliases)&&c.aliases.every(function(a){return typeof a==="string";})));
  }
  function validRequest(r){
    return isObject(r)&&typeof r.id==="string"&&!!r.id.trim()&&typeof r.reference==="string"&&!!r.reference.trim()&&
      ["pending","approved","rejected","cancelled"].includes(r.status)&&
      isObject(r.customer)&&typeof r.customer.name==="string"&&
      (r.customer.customerId==null||typeof r.customer.customerId==="string")&&
      isObject(r.service)&&typeof r.service.id==="string"&&isObject(r.specifications)&&
      (r.events==null||(Array.isArray(r.events)&&r.events.every(function(e){return isObject(e)&&typeof e.status==="string";})));
  }
  function uniqueIds(items){return new Set(items.map(function(item){return item.id;})).size===items.length;}
  function validateBackup(data){
    if(!isObject(data)||data.schema!=="paprint-backup"||![1,2].includes(data.version)||
       !Array.isArray(data.orders)||!Array.isArray(data.customers)||
       (data.version===2&&!Array.isArray(data.requests))) {
      throw new Error("Unsupported backup. Choose a PaPrint v1 or v2 JSON backup.");
    }
    var requests=data.version===2?data.requests:[];
    if(!data.orders.every(validOrder)||!data.customers.every(validCustomer)||!requests.every(validRequest)||
       !uniqueIds(data.orders)||!uniqueIds(data.customers)||!uniqueIds(requests)){
      throw new Error("Invalid backup: missing or duplicated record information.");
    }
    if(new Set(requests.map(function(r){return r.reference;})).size!==requests.length){
      throw new Error("Invalid backup: duplicate request references.");
    }
    return {schema:data.schema,version:data.version,exportedAt:data.exportedAt,
      orders:data.orders,customers:data.customers,requests:requests};
  }
  function resetPreview(text){selected=null;preview.hidden=true;message.textContent=text;}
  function isWalkin(order){var c=order.customer||{};return c.type==="walkin"||!String(c.name||"").trim();}

  document.querySelector("#exportBackup").addEventListener("click",function(){
    var data={schema:"paprint-backup",version:2,exportedAt:new Date().toISOString(),
      orders:PaPrint.storage.getOrders(),customers:PaPrint.storage.getCustomers(),requests:PaPrint.storage.getRequests()};
    var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    var link=document.createElement("a");link.href=url;link.download="paprint-backup-v2.json";
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
    PaPrint.ui.toast("Orders, customers, and request metadata exported. File attachments are not included.");
  });
  input.addEventListener("change",async function(){
    resetPreview("Reading selected backup...");
    var file=input.files&&input.files[0];
    if(!file){resetPreview("Choose a JSON backup file.");return;}
    if(file.size>maxFileSize){resetPreview("Backup file must be no larger than 5 MB.");return;}
    try {
      var data=validateBackup(JSON.parse(await file.text()));
      if(!input.files||input.files[0]!==file)return;
      selected=data;
      document.querySelector("#backupOrderCount").textContent=String(data.orders.length);
      document.querySelector("#backupCustomerCount").textContent=String(data.customers.length);
      document.querySelector("#backupRequestCount").textContent=String(data.requests.length);
      document.querySelector("#backupWalkinCount").textContent=String(data.orders.filter(isWalkin).length);
      var parsed=new Date(data.exportedAt);
      document.querySelector("#backupDate").textContent=data.exportedAt&&!Number.isNaN(parsed.getTime())?PaPrint.formatDate(data.exportedAt):"Not recorded";
      document.querySelector("#legacyBackupWarning").hidden=data.version!==1;
      preview.hidden=false;
      message.textContent="Version "+data.version+" backup validated. Check the counts and warnings before restoring.";
    } catch(error) {
      resetPreview(error instanceof SyntaxError?"This is not valid JSON.":error.message||"Unable to read backup.");
    }
  });
  restore.addEventListener("click",async function(){
    if(!selected){PaPrint.ui.toast("Select and preview a valid backup first.");return;}
    var data=selected;
    var okay=await PaPrint.ui.confirmAction({
      title:"Replace all local records?",
      message:"Replace existing data with "+data.orders.length+" orders, "+data.customers.length+
        " customers and "+data.requests.length+" print requests? "+
        (data.version===1?"This older backup has no print requests; current requests will be cleared. ":"")+
        "Uploaded document files are NOT in JSON backups. Export current data first.",
      confirmText:"Restore backup",cancelText:"Cancel",danger:true
    });
    if(!okay)return;
    var orderKey=PaPrint.config.storageKeys.orders;
    var previous=[orderKey,customerKey,requestKey].map(function(key){return{key:key,raw:localStorage.getItem(key)};});
    try{
      PaPrint.storage.saveOrders(data.orders);
      PaPrint.storage.saveCustomers(data.customers);
      PaPrint.storage.saveRequests(data.requests);
      PaPrint.ui.toast("Backup restored. Refresh other open tabs.");
      message.textContent="Restored "+data.orders.length+" jobs, "+data.customers.length+" customers, "+data.requests.length+" requests. Attachments were not restored.";
    }catch(error){
      try{previous.forEach(function(item){if(item.raw==null)localStorage.removeItem(item.key);else localStorage.setItem(item.key,item.raw);});
        PaPrint.ui.toast("Restore failed; previous records recovered.");
      }catch(rollbackError){PaPrint.ui.toast("Restore and rollback failed. Restore from a separate backup.");}
    }
  });
});
