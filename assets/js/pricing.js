(function (app) {
  "use strict";

  function positiveNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0
      ? number
      : (fallback || 1);
  }

  function calculate(job) {
    var serviceId = job && job.service ? job.service.id : "";
    var specs = (job && job.specifications) || {};

    var basePrice = 0;
    var finishingFee = 0;
    var rushFee = specs.rush ? app.config.rushFee : 0;

    if (serviceId === "document-printing") {
      var pages = positiveNumber(specs.pages);
      var copies = positiveNumber(specs.copies);
      var perPage = specs.colorMode === "color" ? 6 : 2;
      basePrice = pages * copies * perPage;

      var finishFees = {
        none: 0,
        staple: 5,
        "comb-binding": 35,
        lamination: 15
      };

      finishingFee = finishFees[specs.finishing] || 0;
    }

    if (serviceId === "photocopy") {
      var copyPages = positiveNumber(specs.pages);
      var copyCount = positiveNumber(specs.copies);
      var copyRate = specs.colorMode === "color" ? 5 : 1.5;
      basePrice = copyPages * copyCount * copyRate;
    }

    if (serviceId === "photo-printing") {
      var photoRates = {
        "4R": 10,
        "5R": 15,
        "A4": 35
      };
      basePrice = (photoRates[specs.photoSize] || 10) * positiveNumber(specs.quantity);
    }

    if (serviceId === "lamination") {
      var laminationRates = {
        "ID": 15,
        "A4": 25,
        "Long": 30
      };
      basePrice = (laminationRates[specs.laminationSize] || 15) * positiveNumber(specs.quantity);
    }

    if (serviceId === "binding") {
      basePrice = 35 * positiveNumber(specs.sets);
    }

    if (serviceId === "scanning") {
      basePrice = 5 * positiveNumber(specs.pages);
      if (specs.colorMode === "color") {
        basePrice += 2 * positiveNumber(specs.pages);
      }
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
    calculate: calculate
  };
})(window.PaPrint);
