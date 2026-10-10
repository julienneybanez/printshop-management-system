document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "new-job",
    title: "New Print Job"
  });

  var form = document.querySelector("#jobForm");
  var serviceSelect = document.querySelector("#service");
  var serviceFields = document.querySelector("#serviceFields");
  var params = new URLSearchParams(window.location.search);
  var selectedFromUrl = params.get("service");
  var editMode = params.get("edit") === "1";
  var editOrderId = params.get("editOrder");
  var savedOrder = editOrderId ? PaPrint.storage.getOrders().find(function(o){return o.id===editOrderId;}) : null;
  if (editOrderId && !PaPrint.storage.canEdit(savedOrder)) {
    PaPrint.ui.toast("Only received jobs can be edited.");
    window.location.replace("queue.html");
    return;
  }
  var existingDraft = savedOrder ? { customer:savedOrder.customer, service:savedOrder.service,
    specifications:savedOrder.specifications, priority:savedOrder.priority,
    deadline:savedOrder.deadline, pickupSlot:savedOrder.pickupSlot } :
    (editMode ? PaPrint.storage.getDraft() : null);

  PaPrint.config.services.forEach(function (service) {
    var option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.name;
    serviceSelect.appendChild(option);
  });

  if (existingDraft && existingDraft.service) {
    serviceSelect.value = existingDraft.service.id;
  } else if (selectedFromUrl && PaPrint.getService(selectedFromUrl)) {
    serviceSelect.value = selectedFromUrl;
  }

  function numberField(id, label, valueLabel) {
    return (
      '<div class="field">' +
        '<label for="' + id + '">' + label + "</label>" +
        '<input class="input" id="' + id + '" name="' + id + '" type="number" min="1" value="' +
          (valueLabel || 1) +
        '" required>' +
      "</div>"
    );
  }

  function selectField(id, label, options) {
    return (
      '<div class="field">' +
        '<label for="' + id + '">' + label + "</label>" +
        '<select id="' + id + '" name="' + id + '">' +
          options.map(function (option) {
            return '<option value="' + option.value + '">' + option.label + "</option>";
          }).join("") +
        "</select>" +
      "</div>"
    );
  }

  function renderServiceFields() {
    var id = serviceSelect.value;

    if (id === "document-printing") {
      serviceFields.innerHTML =
        numberField("pages", "Number of pages", 1) +
        numberField("copies", "Copies", 1) +
        selectField("paperSize", "Paper size", [
          { value: "A4", label: "A4" },
          { value: "Short", label: "Short" },
          { value: "Long", label: "Long" },
          { value: "Legal", label: "Legal" },
          { value: "A3", label: "A3" }
        ]) +
        selectField("colorMode", "Color mode", [
          { value: "bw", label: "Black & White" },
          { value: "color", label: "Color" }
        ]) +
        selectField("printSides", "Print sides", [
          { value: "single", label: "Single-sided" },
          { value: "double", label: "Double-sided" }
        ]) +
        selectField("finishing", "Finishing", [
          { value: "none", label: "None" },
          { value: "staple", label: "Staple" },
          { value: "comb-binding", label: "Comb Binding" },
          { value: "lamination", label: "Lamination" }
        ]);
    }

    if (id === "photocopy") {
      serviceFields.innerHTML =
        numberField("pages", "Number of pages", 1) +
        numberField("copies", "Copies", 1) +
        selectField("paperSize", "Paper size", [
          { value: "A4", label: "A4" },
          { value: "Short", label: "Short" },
          { value: "Long", label: "Long" },
          { value: "Legal", label: "Legal" }
        ]) +
        selectField("colorMode", "Color mode", [
          { value: "bw", label: "Black & White" },
          { value: "color", label: "Color" }
        ]) +
        selectField("printSides", "Copy sides", [
          { value: "single", label: "Single-sided" },
          { value: "double", label: "Double-sided" }
        ]);
    }

    if (id === "photo-printing") {
      serviceFields.innerHTML =
        selectField("photoSize", "Photo size", [
          { value: "4R", label: "4R" },
          { value: "5R", label: "5R" },
          { value: "A4", label: "A4" }
        ]) +
        numberField("quantity", "Quantity", 1);
    }

    if (id === "lamination") {
      serviceFields.innerHTML =
        selectField("laminationSize", "Size", [
          { value: "ID", label: "ID" },
          { value: "A4", label: "A4" },
          { value: "Long", label: "Long" }
        ]) +
        numberField("quantity", "Quantity", 1);
    }

    if (id === "binding") {
      serviceFields.innerHTML =
        numberField("pages", "Number of pages", 1) +
        numberField("sets", "Number of sets", 1);
    }

    if (id === "scanning") {
      serviceFields.innerHTML =
        numberField("pages", "Number of pages", 1) +
        selectField("colorMode", "Color mode", [
          { value: "bw", label: "Black & White" },
          { value: "color", label: "Color" }
        ]) +
        selectField("outputFormat", "Output format", [
          { value: "pdf", label: "PDF" },
          { value: "jpg", label: "JPG" },
          { value: "png", label: "PNG" }
        ]);
    }

    if (existingDraft && existingDraft.service && existingDraft.service.id === id) {
      restoreServiceFields(existingDraft.specifications || {});
    }

    updatePrice();
  }

  function restoreServiceFields(specs) {
    Object.keys(specs).forEach(function (key) {
      var field = document.querySelector("#" + key);
      if (!field) return;

      if (field.type === "checkbox") {
        field.checked = Boolean(specs[key]);
      } else {
        field.value = specs[key];
      }
    });
  }

  function readSpecifications() {
    var specs = {
      rush: document.querySelector("#rush").checked,
      notes: document.querySelector("#notes").value.trim()
    };

    serviceFields.querySelectorAll("input, select").forEach(function (field) {
      if (field.type === "number") {
        specs[field.name] = Number(field.value);
      } else {
        specs[field.name] = field.value;
      }
    });

    return specs;
  }

  function buildDraft() {
    var service = PaPrint.getService(serviceSelect.value);
    var specs = readSpecifications();

    var base = {
      customer: document.querySelector("#customerType").value === "walkin" ?
        { type: "walkin", name: "Walk-in Customer", contact: "", saveToRecords: false } :
        { type: "named", name: document.querySelector("#customerName").value.trim(),
          contact: document.querySelector("#contact").value.trim(),
          saveToRecords: document.querySelector("#saveCustomer").checked },
      service: {
        id: service.id,
        name: service.name
      },
      specifications: specs,
      priority: document.querySelector("#priority").value,
      deadline: document.querySelector("#deadline").value,
      pickupSlot: document.querySelector("#pickupSlot").value
    };

    base.pricing = PaPrint.pricing.calculate(base);

    return base;
  }

  function updatePrice() {
    var draft = buildDraft();
    var pricing = draft.pricing;

    document.querySelector("[data-base-price]").textContent =
      PaPrint.formatMoney(pricing.basePrice);

    document.querySelector("[data-finishing-fee]").textContent =
      PaPrint.formatMoney(pricing.finishingFee);

    document.querySelector("[data-rush-fee]").textContent =
      PaPrint.formatMoney(pricing.rushFee);

    document.querySelector("[data-total]").textContent =
      PaPrint.formatMoney(pricing.total);
  }

  function validateContact() {
    var field = document.querySelector("#contact");
    var value = field.value.replace(/\s+/g, "");
    var valid = !value || /^(09|\+639)\d{9}$/.test(value);

    field.setAttribute("aria-invalid", String(!valid));

    if (!valid) {
      field.setCustomValidity("Enter a valid Philippine mobile number.");
    } else {
      field.setCustomValidity("");
    }

    return valid;
  }

  var customerType = document.querySelector("#customerType");
  function syncCustomerType() {
    var named = customerType.value === "named";
    document.querySelector("#namedCustomerFields").hidden = !named;
    document.querySelector("#customerName").required = named;
    if (!named) { document.querySelector("#contact").setCustomValidity(""); document.querySelector("#contact").removeAttribute("aria-invalid"); }
  }
  customerType.addEventListener("change", syncCustomerType);

  serviceSelect.addEventListener("change", function () {
    existingDraft = null;
    renderServiceFields();
  });

  serviceFields.addEventListener("input", updatePrice);
  serviceFields.addEventListener("change", updatePrice);
  document.querySelector("#rush").addEventListener("change", function () {
    if (this.checked) document.querySelector("#priority").value = "rush";
    updatePrice();
  });
  document.querySelector("#priority").addEventListener("change", function () {
    document.querySelector("#rush").checked = this.value === "rush";
    updatePrice();
  });
  document.querySelector("#contact").addEventListener("input", validateContact);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (customerType.value === "named") validateContact();

    if (!form.reportValidity()) return;

    var draft = buildDraft();
    if (draft.pickupSlot && PaPrint.storage.pickupCount(draft.pickupSlot, editOrderId) >= PaPrint.storage.slotCapacity) {
      PaPrint.ui.toast("This pickup window is full. Choose a different one."); return;
    }
    if (draft.deadline && new Date(draft.deadline).getTime() <= Date.now()) {
      PaPrint.ui.toast("Deadline must be in the future."); return;
    }
    if (savedOrder) {
      if (!PaPrint.storage.canEdit(PaPrint.storage.getOrders().find(function(o){return o.id===editOrderId;}))) {
        PaPrint.ui.toast("This order can no longer be edited."); return;
      }
      if (draft.pickupSlot && PaPrint.storage.pickupCount(draft.pickupSlot, editOrderId) >= PaPrint.storage.slotCapacity) {
        PaPrint.ui.toast("This pickup slot is full.");return;
      }
      var customer = draft.customer.type === "named" && draft.customer.saveToRecords ? PaPrint.storage.upsertCustomer(draft.customer) : null;
      PaPrint.storage.updateOrder(editOrderId,function(order){
        order.customer = Object.assign({},draft.customer,{customerId:customer&&customer.id || draft.customer.customerId || null});
        order.service=draft.service;order.specifications=draft.specifications;order.pricing=draft.pricing;
        order.priority=draft.priority;order.deadline=draft.deadline;order.pickupSlot=draft.pickupSlot;
        return order;
      });
      window.location.href="job-details.html?id="+encodeURIComponent(editOrderId);return;
    }
    PaPrint.storage.saveDraft(draft);
    window.location.href = "order-review.html";
  });

  if (existingDraft) {
    customerType.value = existingDraft.customer && existingDraft.customer.type === "walkin" || !existingDraft.customer || existingDraft.customer.name === "Walk-in Customer" ? "walkin" : "named";
    document.querySelector("#saveCustomer").checked = Boolean(existingDraft.customer && existingDraft.customer.saveToRecords);
    document.querySelector("#customerName").value = existingDraft.customer && existingDraft.customer.name !== "Walk-in Customer" ? existingDraft.customer.name || "" : "";
    document.querySelector("#contact").value = existingDraft.customer && existingDraft.customer.contact || "";
    document.querySelector("#rush").checked = Boolean(existingDraft.specifications && existingDraft.specifications.rush);
    document.querySelector("#priority").value = existingDraft.priority || (existingDraft.specifications && existingDraft.specifications.rush ? "rush" : "normal");
    document.querySelector("#deadline").value = existingDraft.deadline || "";
    document.querySelector("#pickupSlot").value = existingDraft.pickupSlot || "";
    document.querySelector("#notes").value = existingDraft.specifications && existingDraft.specifications.notes || "";
  }

  syncCustomerType();
  renderServiceFields();
  if (existingDraft && existingDraft.specifications) { restoreServiceFields(existingDraft.specifications); updatePrice(); }
});
