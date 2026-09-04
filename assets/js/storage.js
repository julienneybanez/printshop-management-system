(function (app) {
  "use strict";

  function safeParse(rawValue, fallback) {
    try {
      return rawValue ? JSON.parse(rawValue) : fallback;
    } catch (error) {
      console.warn("PaPrint could not read saved data.", error);
      return fallback;
    }
  }

  function getOrders() {
    var orders = safeParse(
      localStorage.getItem(app.config.storageKeys.orders),
      []
    );

    return Array.isArray(orders) ? orders : [];
  }

  function saveOrders(orders) {
    localStorage.setItem(
      app.config.storageKeys.orders,
      JSON.stringify(Array.isArray(orders) ? orders : [])
    );
  }

  function getDraft() {
    return safeParse(
      localStorage.getItem(app.config.storageKeys.draft),
      null
    );
  }

  function saveDraft(draft) {
    localStorage.setItem(
      app.config.storageKeys.draft,
      JSON.stringify(draft)
    );
  }

  function clearDraft() {
    localStorage.removeItem(app.config.storageKeys.draft);
  }

  function generateQueueNumber() {
    var orders = getOrders();
    var prefix = app.config.queuePrefix + "-";

    var highest = orders.reduce(function (max, order) {
      var numericPart = Number(
        String(order.queueNumber || "").replace(prefix, "")
      );

      return Number.isFinite(numericPart)
        ? Math.max(max, numericPart)
        : max;
    }, 0);

    return app.config.queuePrefix + "-" + String(highest + 1).padStart(3, "0");
  }

  function addOrder(draft) {
    var orders = getOrders();
    var now = new Date().toISOString();

    var order = {
      id: app.generateId(),
      queueNumber: generateQueueNumber(),
      createdAt: now,
      updatedAt: now,
      customer: draft.customer,
      service: draft.service,
      specifications: draft.specifications,
      pricing: draft.pricing,
      status: "received",
      statusHistory: [
        {
          status: "received",
          timestamp: now
        }
      ]
    };

    orders.unshift(order);
    saveOrders(orders);

    return order;
  }

  function updateOrder(orderId, updater) {
    var orders = getOrders();
    var index = orders.findIndex(function (order) {
      return order.id === orderId;
    });

    if (index === -1) return null;

    var current = orders[index];
    var updated = typeof updater === "function"
      ? updater(Object.assign({}, current))
      : Object.assign({}, current, updater || {});

    updated.updatedAt = new Date().toISOString();
    orders[index] = updated;
    saveOrders(orders);

    return updated;
  }

  function updateStatus(orderId, status) {
    if (!app.config.statuses[status]) return null;

    return updateOrder(orderId, function (order) {
      order.status = status;
      order.statusHistory = Array.isArray(order.statusHistory)
        ? order.statusHistory.slice()
        : [];

      order.statusHistory.push({
        status: status,
        timestamp: new Date().toISOString()
      });

      return order;
    });
  }

  app.storage = {
    getOrders: getOrders,
    saveOrders: saveOrders,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    generateQueueNumber: generateQueueNumber,
    addOrder: addOrder,
    updateOrder: updateOrder,
    updateStatus: updateStatus
  };
})(window.PaPrint);
