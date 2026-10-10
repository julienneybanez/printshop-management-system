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

  var CUSTOMER_KEY = "paprint_v1_customers";
  function getCustomers() {
    var values = safeParse(localStorage.getItem(CUSTOMER_KEY), []);
    return Array.isArray(values) ? values : [];
  }
  function saveCustomers(values) { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(values)); }
  function upsertCustomer(customer) {
    var name = String(customer && customer.name || "").trim();
    var contact = String(customer && customer.contact || "").trim();
    if (!name || !contact) return null;
    var values = getCustomers();
    var found = values.find(function (entry) { return entry.contact === contact; });
    if (found) { found.name = name; } else {
      found = { id: app.generateId(), name: name, contact: contact };
      values.push(found);
    }
    saveCustomers(values);
    return found;
  }
  function pickupCount(slot, ignoredId) {
    return getOrders().filter(function (order) {
      return order.id !== ignoredId && order.pickupSlot === slot &&
        order.status !== "cancelled" && order.status !== "claimed";
    }).length;
  }
  var SLOT_CAPACITY = 3;
  function canCancel(order) { return !!order && order.status === "received"; }
  function canEdit(order) { return !!order && order.status === "received"; }
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
    if (draft.pickupSlot && pickupCount(draft.pickupSlot) >= SLOT_CAPACITY) {
      throw new Error("This pickup slot is full. Please choose another.");
    }
    var customerRecord = upsertCustomer(draft.customer);

    var order = {
      id: app.generateId(),
      queueNumber: generateQueueNumber(),
      createdAt: now,
      updatedAt: now,
      customer: Object.assign({}, draft.customer, { customerId: customerRecord && customerRecord.id }),
      priority: draft.priority || (draft.specifications && draft.specifications.rush ? "rush" : "normal"),
      deadline: draft.deadline || "",
      pickupSlot: draft.pickupSlot || "",
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
    var current = getOrders().find(function (order) { return order.id === orderId; });
    if (!current) return null;
    if (status === "cancelled" && !canCancel(current)) return null;
    if (["claimed", "cancelled"].includes(current.status)) return null;

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
    getCustomers: getCustomers,
    saveCustomers: saveCustomers,
    upsertCustomer: upsertCustomer,
    pickupCount: pickupCount,
    slotCapacity: SLOT_CAPACITY,
    canCancel: canCancel,
    canEdit: canEdit,
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
