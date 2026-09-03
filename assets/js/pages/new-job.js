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
  var existingDraft = editMode ? PaPrint.storage.getDraft() : null;

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
      customer: {
        name: document.querySelector("#customerName").value.trim(),
        contact: document.querySelector("#contact").value.trim()
      },
      service: {
        id: service.id,
        name: service.name
      },
      specifications: specs
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
    var valid = /^(09|\+639)\d{9}$/.test(value);

    field.setAttribute("aria-invalid", String(!valid));

    if (!valid) {
      field.setCustomValidity("Enter a valid Philippine mobile number.");
    } else {
      field.setCustomValidity("");
    }

    return valid;
  }

  serviceSelect.addEventListener("change", function () {
    existingDraft = null;
    renderServiceFields();
  });

  serviceFields.addEventListener("input", updatePrice);
  serviceFields.addEventListener("change", updatePrice);
  document.querySelector("#rush").addEventListener("change", updatePrice);
  document.querySelector("#contact").addEventListener("input", validateContact);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    validateContact();

    if (!form.reportValidity()) return;

    var draft = buildDraft();
    PaPrint.storage.saveDraft(draft);
    window.location.href = "order-review.html";
  });

  if (existingDraft) {
    document.querySelector("#customerName").value = existingDraft.customer && existingDraft.customer.name || "";
    document.querySelector("#contact").value = existingDraft.customer && existingDraft.customer.contact || "";
    document.querySelector("#rush").checked = Boolean(existingDraft.specifications && existingDraft.specifications.rush);
    document.querySelector("#notes").value = existingDraft.specifications && existingDraft.specifications.notes || "";
  }

  renderServiceFields();
});
