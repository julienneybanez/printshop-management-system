(function (app) {
  "use strict";

  // Editable shop rates. Each configured amount is in Philippine pesos.
  var groups = [
    { id: "document-printing", label: "Document Printing", fields: [
      { key: "bw", label: "Black & white (per page)", default: 2 },
      { key: "color", label: "Color (per page)", default: 6 },
      { key: "staple", label: "Stapling (per job)", default: 5 },
      { key: "comb-binding", label: "Comb binding (per job)", default: 35 },
      { key: "lamination", label: "Lamination (per job)", default: 15 }
    ] },
    { id: "photocopy", label: "Photocopy", fields: [
      { key: "bw", label: "Black & white (per page)", default: 1.5 },
      { key: "color", label: "Color (per page)", default: 5 }
    ] },
    { id: "photo-printing", label: "Photo Printing", fields: [
      { key: "4R", label: "4R (per print)", default: 10 },
      { key: "5R", label: "5R (per print)", default: 15 },
      { key: "A4", label: "A4 (per print)", default: 35 }
    ] },
    { id: "lamination", label: "Lamination", fields: [
      { key: "ID", label: "ID size (per piece)", default: 15 },
      { key: "A4", label: "A4 (per piece)", default: 25 },
      { key: "Long", label: "Long (per piece)", default: 30 }
    ] },
    { id: "binding", label: "Binding", fields: [
      { key: "perSet", label: "Comb binding (per set)", default: 35 }
    ] },
    { id: "scanning", label: "Scanning", fields: [
      { key: "bw", label: "Black & white (per page)", default: 5 },
      { key: "color", label: "Color (per page)", default: 7 }
    ] },
    { id: "general", label: "Additional Charges", fields: [
      { key: "rushFee", label: "Rush fee (per job)", default: 20 }
    ] }
  ];

  function getGroup(id) {
    return groups.find(function (group) { return group.id === id; }) || null;
  }

  function allRates() {
    var overrides = app.storage && app.storage.getPricingRates
      ? app.storage.getPricingRates() : {};
    var rates = {};
    groups.forEach(function (group) {
      var stored = overrides[group.id] || {};
      rates[group.id] = {};
      group.fields.forEach(function (field) {
        var value = stored[field.key];
        rates[group.id][field.key] =
          typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000
            ? value : field.default;
      });
    });
    return rates;
  }

  function saveGroup(id, values) {
    var group = getGroup(id);
    if (!group) throw new Error("Unknown pricing group.");
    var validated = {};
    group.fields.forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(values || {}, field.key)) {
        throw new Error("Missing rate for " + field.label + ".");
      }
      var input = values[field.key];
      if (input === "" || input == null || !Number.isFinite(Number(input)) ||
          Number(input) < 0 || Number(input) > 100000) {
        throw new Error("Enter a valid price from ₱0 to ₱100,000 for " + field.label + ".");
      }
      validated[field.key] = Number(Number(input).toFixed(2));
    });
    var overrides = app.storage.getPricingRates();
    overrides[id] = validated;
    app.storage.savePricingRates(overrides);
    return validated;
  }

  function resetGroup(id) {
    if (!getGroup(id)) throw new Error("Unknown pricing group.");
    var overrides = app.storage.getPricingRates();
    delete overrides[id];
    app.storage.savePricingRates(overrides);
  }

  function startingPrice(service) {
    var rates = allRates();
    var id = typeof service === "string" ? service : service && service.id;
    var baseKey = { "document-printing": "bw", photocopy: "bw",
      "photo-printing": "4R", lamination: "ID", binding: "perSet", scanning: "bw" };
    var key = baseKey[id];
    return key && rates[id] ? rates[id][key] : 0;
  }

  function positiveNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : (fallback || 1);
  }

  function calculate(job) {
    var serviceId = job && job.service ? job.service.id : "";
    var specs = (job && job.specifications) || {};
    var rates = allRates();

    var basePrice = 0;
    var finishingFee = 0;
    var rushFee = specs.rush ? rates.general.rushFee : 0;

    if (serviceId === "document-printing") {
      var pages = positiveNumber(specs.pages);
      var copies = positiveNumber(specs.copies);
      var perPage = specs.colorMode === "color" ? rates["document-printing"].color : rates["document-printing"].bw;
      basePrice = pages * copies * perPage;

      var finishFees = {
        none: 0,
        staple: rates["document-printing"].staple,
        "comb-binding": rates["document-printing"]["comb-binding"],
        lamination: rates["document-printing"].lamination
      };
      finishingFee = finishFees[specs.finishing] || 0;
    }
    if (serviceId === "photocopy") {
      var copyPages = positiveNumber(specs.pages);
      var copyCount = positiveNumber(specs.copies);
      var copyRate = specs.colorMode === "color" ? rates.photocopy.color : rates.photocopy.bw;
      basePrice = copyPages * copyCount * copyRate;
    }
    if (serviceId === "photo-printing") {
      basePrice = (rates["photo-printing"][specs.photoSize] ?? rates["photo-printing"]["4R"]) * positiveNumber(specs.quantity);
    }
    if (serviceId === "lamination") {
      basePrice = (rates.lamination[specs.laminationSize] ?? rates.lamination.ID) * positiveNumber(specs.quantity);
    }
    if (serviceId === "binding") {
      basePrice = rates.binding.perSet * positiveNumber(specs.sets);
    }
    if (serviceId === "scanning") {
      var scanningRate = specs.colorMode === "color" ? rates.scanning.color : rates.scanning.bw;
      basePrice = scanningRate * positiveNumber(specs.pages);
    }

    var total = basePrice + finishingFee + rushFee;
    return {
      basePrice: Number(basePrice.toFixed(2)),
      finishingFee: Number(finishingFee.toFixed(2)),
      rushFee: Number(rushFee.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }

  app.pricing = {
    calculate: calculate,
    getGroups: function () { return groups.slice(); },
    getGroup: getGroup,
    getRates: allRates,
    saveGroup: saveGroup,
    resetGroup: resetGroup,
    startingPrice: startingPrice
  };
})(window.PaPrint);
