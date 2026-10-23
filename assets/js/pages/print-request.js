document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  PaPrint.ui.initCustomerShell("request");
  var form = document.querySelector("#requestForm");
  var fileInput = document.querySelector("#requestFile");
  var maxSize = 10 * 1024 * 1024;
  var allowed = ["application/pdf", "image/jpeg", "image/png"];
  var previewUrl = null;

  PaPrint.config.services.forEach(function (service) {
    var option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.name;
    document.querySelector("#requestService").appendChild(option);
  });

  fileInput.addEventListener("change", function () {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    var file = fileInput.files[0];
    var info = document.querySelector("#requestFileInfo");
    info.textContent = file ? file.name + " (" + (file.size / 1024).toFixed(1) + " KB)" : "No file selected";
    var oldPreview = document.querySelector("#documentPreview");
    if (oldPreview) oldPreview.remove();
    if (!file || !allowed.includes(file.type)) return;
    previewUrl = URL.createObjectURL(file);
    var element = document.createElement(file.type === "application/pdf" ? "iframe" : "img");
    element.id = "documentPreview";
    element.src = previewUrl;
    element.title = "Selected file preview";
    element.style.cssText = "display:block;width:100%;max-width:520px;height:280px;object-fit:contain;border:1px solid var(--line);border-radius:12px;margin-top:12px";
    info.after(element);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    var file = fileInput.files[0];
    if (!file || file.size > maxSize || !allowed.includes(file.type)) {
      PaPrint.ui.toast("Select a PDF/JPG/PNG file under 10 MB."); return;
    }
    var submit = document.querySelector("#submitRequest");
    submit.disabled = true;
    var id = PaPrint.generateId();
    try {
      await PaPrint.files.put(id, file);
      var now = new Date().toISOString();
      var request = {
        id:id, reference:"R-" + Date.now().toString(36).toUpperCase(), createdAt:now,
        updatedAt:now, status:"pending",
        customer:{
          name:document.querySelector("#requestName").value.trim(),
          contact:document.querySelector("#requestContact").value.trim()
        },
        service:PaPrint.getService(document.querySelector("#requestService").value),
        specifications:{
          copies:Number(document.querySelector("#requestCopies").value),
          paperSize:document.querySelector("#requestPaper").value,
          colorMode:document.querySelector("#requestColor").value,
          notes:document.querySelector("#requestNotes").value.trim()
        },
        fileName:file.name, fileType:file.type, fileSize:file.size,
        orderId:null, events:[{status:"pending", label:"Request submitted", timestamp:now}]
      };
      // This creates a distinct Customer Record. Staff may later link/merge it after verifying identity.
      var saved = PaPrint.storage.saveCustomerRequest(request);
      form.hidden = true;
      var success = document.querySelector("#requestSuccess");
      success.hidden = false;
      success.innerHTML = '<h2>Request submitted</h2><p>Save this reference number to track your request. Staff can link returning customer records after verification.</p>' +
        '<div class="request-reference">' + PaPrint.escapeHTML(saved.reference) + '</div>' +
        '<a class="btn btn-primary" href="track-order.html?ref=' + encodeURIComponent(saved.reference) + '">Track request</a>';
    } catch (error) {
      try { await PaPrint.files.remove(id); } catch (cleanupError) { console.warn(cleanupError); }
      PaPrint.ui.toast("Request could not be saved. Check your browser's storage.");
      submit.disabled = false;
    }
  });
});
