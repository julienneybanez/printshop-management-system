document.addEventListener("DOMContentLoaded", function () {
  PaPrint.ui.initCustomerShell("request");
  var form=document.querySelector("#requestForm");
  var fileInput=document.querySelector("#requestFile");
  var MAX=10*1024*1024;
  PaPrint.config.services.forEach(function (s) {var option=document.createElement("option");option.value=s.id;option.textContent=s.name;document.querySelector("#requestService").appendChild(option);});
  var previewUrl=null;
  fileInput.addEventListener("change",function(){
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
    var file=fileInput.files[0];var info=document.querySelector("#requestFileInfo");info.textContent=file?file.name+" ("+(file.size/1024).toFixed(1)+" KB)":"No file selected";
    var old=document.querySelector("#documentPreview");if(old)old.remove();
    if(file&&["application/pdf","image/jpeg","image/png"].includes(file.type)){
      previewUrl=URL.createObjectURL(file);
      var el=document.createElement(file.type==="application/pdf"?"iframe":"img");el.id="documentPreview";el.src=previewUrl;el.title="Selected file preview";el.style.cssText="display:block;width:100%;max-width:520px;height:280px;object-fit:contain;border:1px solid var(--line);border-radius:12px;margin-top:12px";info.after(el);
    }
  });
  form.addEventListener("submit",async function (e) {
    e.preventDefault();
    var file=fileInput.files[0];
    if(!file||file.size>MAX||!["application/pdf","image/jpeg","image/png"].includes(file.type)){PaPrint.ui.toast("Select a PDF/JPG/PNG file under 10 MB.");return;}
    var button=document.querySelector("#submitRequest");button.disabled=true;
    var id=PaPrint.generateId();
    try {
      await PaPrint.files.put(id,file);
      var now=new Date().toISOString();
      var request={id:id,reference:"R-"+Date.now().toString(36).toUpperCase(),createdAt:now,updatedAt:now,status:"pending",customer:{name:document.querySelector("#requestName").value.trim(),contact:document.querySelector("#requestContact").value.trim()},service:PaPrint.getService(document.querySelector("#requestService").value),specifications:{copies:Number(document.querySelector("#requestCopies").value),paperSize:document.querySelector("#requestPaper").value,colorMode:document.querySelector("#requestColor").value,notes:document.querySelector("#requestNotes").value.trim()},fileName:file.name,fileType:file.type,fileSize:file.size,orderId:null,events:[{status:"pending",label:"Request submitted",timestamp:now}]};
      var all=PaPrint.storage.getRequests();all.unshift(request);PaPrint.storage.saveRequests(all);
      form.hidden=true;var success=document.querySelector("#requestSuccess");success.hidden=false;
      success.innerHTML='<h2>Request submitted</h2><p>Keep your reference number to track your request.</p><div class="request-reference">'+PaPrint.escapeHTML(request.reference)+'</div><a class="btn btn-primary" href="track-order.html?ref='+encodeURIComponent(request.reference)+'">Track request</a>';
    }catch(err){PaPrint.ui.toast("Could not save the document locally. Check browser storage availability.");button.disabled=false;}
  });
});
