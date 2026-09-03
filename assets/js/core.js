window.PaPrint = window.PaPrint || {};

(function (app) {
  "use strict";

  app.config = {
    storageKeys: {
      orders: "paprint_v1_orders",
      draft: "paprint_v1_draft"
    },

    queuePrefix: "P",

    statuses: {
      received: "Received",
      printing: "Printing",
      finishing: "Finishing",
      ready: "Ready",
      claimed: "Claimed",
      cancelled: "Cancelled"
    },

    rushFee: 20,

    services: [
      {
        id: "document-printing",
        name: "Document Printing",
        category: "printing",
        icon: "▤",
        description: "Reports, assignments, forms, resumes, and other documents.",
        startingPrice: 2,
        unit: "page"
      },
      {
        id: "photocopy",
        name: "Photocopy",
        category: "photocopy",
        icon: "▣",
        description: "Black-and-white and color photocopying.",
        startingPrice: 1.5,
        unit: "page"
      },
      {
        id: "photo-printing",
        name: "Photo Printing",
        category: "photo",
        icon: "▧",
        description: "Print photos in available sizes.",
        startingPrice: 10,
        unit: "print"
      },
      {
        id: "lamination",
        name: "Lamination",
        category: "finishing",
        icon: "◇",
        description: "Lamination for IDs, certificates, and documents.",
        startingPrice: 15,
        unit: "piece"
      },
      {
        id: "binding",
        name: "Binding",
        category: "finishing",
        icon: "≡",
        description: "Comb binding for reports and documents.",
        startingPrice: 35,
        unit: "set"
      },
      {
        id: "scanning",
        name: "Scanning",
        category: "scanning",
        icon: "⌁",
        description: "Scan documents to a digital file.",
        startingPrice: 5,
        unit: "page"
      }
    ]
  };

  app.getService = function (serviceId) {
    return app.config.services.find(function (service) {
      return service.id === serviceId;
    }) || null;
  };

  app.formatMoney = function (value) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(Number(value || 0));
  };

  app.formatDate = function (isoString) {
    if (!isoString) return "—";

    var date = new Date(isoString);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  app.generateId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "job-" + window.crypto.randomUUID();
    }

    return "job-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  };

  app.escapeHTML = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  app.statusLabel = function (status) {
    return app.config.statuses[status] || status || "—";
  };

  app.statusClass = function (status) {
    return "badge-" + String(status || "").toLowerCase().replace(/\s+/g, "-");
  };

  app.getActiveOrders = function (orders) {
    return (orders || []).filter(function (order) {
      return !["claimed", "cancelled"].includes(order.status);
    });
  };

  app.getArchivedOrders = function (orders) {
    return (orders || []).filter(function (order) {
      return ["claimed", "cancelled"].includes(order.status);
    });
  };

  app.sortQueueOrders = function (orders) {
    return (orders || []).slice().sort(function (a, b) {
      var aRush = Boolean(a.specifications && a.specifications.rush);
      var bRush = Boolean(b.specifications && b.specifications.rush);

      if (aRush !== bRush) {
        return aRush ? -1 : 1;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  };

  app.nextStatus = function (order) {
    if (!order) return null;

    if (order.status === "received") return "printing";

    if (order.status === "printing") {
      var finishing = order.specifications && order.specifications.finishing;
      return finishing && finishing !== "none" ? "finishing" : "ready";
    }

    if (order.status === "finishing") return "ready";
    if (order.status === "ready") return "claimed";

    return null;
  };

  app.specificationRows = function (orderOrDraft) {
    var specs = (orderOrDraft && orderOrDraft.specifications) || {};
    var serviceId = orderOrDraft && orderOrDraft.service ? orderOrDraft.service.id : "";

    var common = [
      ["Service", orderOrDraft && orderOrDraft.service ? orderOrDraft.service.name : "—"]
    ];

    if (serviceId === "document-printing" || serviceId === "photocopy") {
      common.push(
        ["Pages", specs.pages],
        ["Copies", specs.copies],
        ["Paper size", specs.paperSize],
        ["Color", specs.colorMode === "color" ? "Color" : "Black & White"],
        ["Sides", specs.printSides === "double" ? "Double-sided" : "Single-sided"]
      );

      if (serviceId === "document-printing") {
        var finishLabels = {
          none: "None",
          staple: "Staple",
          "comb-binding": "Comb Binding",
          lamination: "Lamination"
        };
        common.push(["Finishing", finishLabels[specs.finishing] || "None"]);
      }
    }

    if (serviceId === "photo-printing") {
      common.push(
        ["Photo size", specs.photoSize],
        ["Quantity", specs.quantity]
      );
    }

    if (serviceId === "lamination") {
      common.push(
        ["Size", specs.laminationSize],
        ["Quantity", specs.quantity]
      );
    }

    if (serviceId === "binding") {
      common.push(
        ["Pages", specs.pages],
        ["Sets", specs.sets]
      );
    }

    if (serviceId === "scanning") {
      common.push(
        ["Pages", specs.pages],
        ["Color", specs.colorMode === "color" ? "Color" : "Black & White"],
        ["Output", String(specs.outputFormat || "").toUpperCase()]
      );
    }

    common.push(["Rush", specs.rush ? "Yes" : "No"]);

    return common.filter(function (row) {
      return row[1] !== undefined && row[1] !== null && row[1] !== "";
    });
  };

  app.orderShortSummary = function (order) {
    var specs = (order && order.specifications) || {};
    var serviceId = order && order.service ? order.service.id : "";

    if (serviceId === "document-printing" || serviceId === "photocopy") {
      return (specs.copies || 1) + " copie(s) • " + (specs.paperSize || "—");
    }

    if (serviceId === "photo-printing") {
      return (specs.quantity || 1) + " print(s) • " + (specs.photoSize || "—");
    }

    if (serviceId === "lamination") {
      return (specs.quantity || 1) + " piece(s) • " + (specs.laminationSize || "—");
    }

    if (serviceId === "binding") {
      return (specs.sets || 1) + " set(s) • " + (specs.pages || 0) + " pages";
    }

    if (serviceId === "scanning") {
      return (specs.pages || 1) + " page(s) • " + String(specs.outputFormat || "PDF").toUpperCase();
    }

    return "Print job";
  };
})(window.PaPrint);
