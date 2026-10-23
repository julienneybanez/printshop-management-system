(function (app) {
  "use strict";

  // All PaPrint records are local to this browser and origin. No real account verification.
  var CUSTOMER_KEY = "paprint_v1_customers";
  var REQUESTS_KEY = "paprint_v1_requests";
  var PRICING_KEY = "paprint_v1_pricing_rates";
  var SLOT_CAPACITY = 3;
  var keys = app.config.storageKeys;

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (error) { console.warn("PaPrint could not read saved data.", error); return fallback; }
  }
  function arrayFrom(key) {
    var data = safeParse(localStorage.getItem(key), []);
    return Array.isArray(data) ? data : [];
  }
  function writeArray(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }
  function getOrders() { return arrayFrom(keys.orders); }
  function saveOrders(orders) { writeArray(keys.orders, Array.isArray(orders) ? orders : []); }
  function getCustomers() { return arrayFrom(CUSTOMER_KEY); }
  function saveCustomers(customers) { writeArray(CUSTOMER_KEY, Array.isArray(customers) ? customers : []); }
  function getRequests() { return arrayFrom(REQUESTS_KEY); }
  function saveRequests(requests) { writeArray(REQUESTS_KEY, Array.isArray(requests) ? requests : []); }
  function getPricingRates() {
    var saved = safeParse(localStorage.getItem(PRICING_KEY), {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  }
  function savePricingRates(rates) {
    if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
      throw new Error("Invalid pricing settings.");
    }
    localStorage.setItem(PRICING_KEY, JSON.stringify(rates));
  }
  function getDraft() { return safeParse(localStorage.getItem(keys.draft), null); }
  function saveDraft(draft) { localStorage.setItem(keys.draft, JSON.stringify(draft)); }
  function clearDraft() { localStorage.removeItem(keys.draft); }
  function normalizedName(name) {
    return String(name || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  }
  function normalizedContact(contact) {
    var digits = String(contact || "").replace(/\D/g, "");
    if (digits.slice(0, 2) === "63" && digits.length === 12) digits = "0" + digits.slice(2);
    return digits.length >= 10 ? digits : "";
  }
  function makeCustomer(data) {
    var name = String(data && data.name || "").trim();
    if (!name) throw new Error("Customer name is required.");
    var now = new Date().toISOString();
    return {
      id: "customer-" + app.generateId(),
      name: name,
      contact: String(data.contact || "").trim(),
      aliases: [],
      source: data.source || "staff",
      createdAt: now,
      updatedAt: now
    };
  }
  function createCustomer(data) {
    // Always create a distinct ID. Names and contacts are not proofs of identity.
    var record = makeCustomer(data);
    var customers = getCustomers();
    customers.push(record);
    saveCustomers(customers);
    return record;
  }
  function upsertCustomer(data) {
    if (!data || !data.id) return createCustomer(data);
    var customers = getCustomers();
    var index = customers.findIndex(function (c) { return c.id === data.id; });
    if (index < 0) return createCustomer(data);
    var previous = customers[index];
    customers[index] = Object.assign({}, previous, {
      name: String(data.name || previous.name).trim(),
      contact: data.contact == null ? previous.contact : String(data.contact).trim(),
      aliases: Array.isArray(previous.aliases) ? previous.aliases : [],
      updatedAt: new Date().toISOString()
    });
    saveCustomers(customers);
    return customers[index];
  }
  function findCustomerCandidates(query) {
    query = query || {};
    var name = normalizedName(query.name);
    var contact = normalizedContact(query.contact);
    return getCustomers().filter(function (c) {
      if (c.id === query.excludeId) return false;
      var names = [c.name].concat(Array.isArray(c.aliases) ? c.aliases : []);
      var nameMatch = !!name && names.some(function (n) { return normalizedName(n) === name; });
      var contactMatch = !!contact && normalizedContact(c.contact) === contact;
      return nameMatch || contactMatch;
    }).map(function (c) {
      return Object.assign({}, c, {
        matchReason: contact && normalizedContact(c.contact) === contact ? "Matching contact (verify identity)" : "Matching name or alias"
      });
    });
  }
  function addCustomerAlias(customerId, alias) {
    var customers = getCustomers();
    var record = customers.find(function (c) { return c.id === customerId; });
    if (!record) throw new Error("Customer record not found.");
    var value = String(alias || "").trim();
    if (!value) throw new Error("Alias must not be empty.");
    var used = [record.name].concat(record.aliases || []).some(function (n) {
      return normalizedName(n) === normalizedName(value);
    });
    if (!used) record.aliases = (record.aliases || []).concat(value);
    record.updatedAt = new Date().toISOString();
    saveCustomers(customers);
    return record;
  }
  function snapshot() {
    return [CUSTOMER_KEY, REQUESTS_KEY, keys.orders].map(function (key) {
      return { key: key, raw: localStorage.getItem(key) };
    });
  }
  function rollback(previous) {
    previous.forEach(function (entry) {
      if (entry.raw == null) localStorage.removeItem(entry.key);
      else localStorage.setItem(entry.key, entry.raw);
    });
  }
  function saveCustomerRequest(request) {
    // Create record and request together, restoring previous local data on failure.
    var previous = snapshot();
    try {
      var customer = createCustomer({
        name: request.customer && request.customer.name,
        contact: request.customer && request.customer.contact,
        source: "customer-request"
      });
      var saved = Object.assign({}, request, {
        customer: Object.assign({}, request.customer, { customerId: customer.id })
      });
      var requests = getRequests();
      requests.unshift(saved);
      saveRequests(requests);
      return saved;
    } catch (error) {
      rollback(previous);
      throw error;
    }
  }
  function ensureRequestCustomerLinks() {
    // Idempotent migration for requests submitted before the new customer-ID feature.
    var requests = getRequests();
    if (!requests.some(function (r) { return r.customer && !r.customer.customerId && r.customer.name; })) return 0;
    var previous = snapshot(), customers = getCustomers(), orders = getOrders(), count = 0;
    try {
      requests.forEach(function (r) {
        if (!r.customer || r.customer.customerId || !String(r.customer.name || "").trim()) return;
        var c = makeCustomer({name:r.customer.name, contact:r.customer.contact, source:"legacy-request"});
        customers.push(c);
        r.customer.customerId = c.id;
        if (r.orderId) {
          var order = orders.find(function (o) { return o.id === r.orderId; });
          if (order) order.customer = Object.assign({}, order.customer, { customerId: c.id });
        }
        count++;
      });
      saveCustomers(customers);
      saveRequests(requests);
      saveOrders(orders);
      return count;
    } catch(error) { rollback(previous); throw error; }
  }
  function linkRequestToCustomer(requestId, customerId) {
    var previous = snapshot();
    var customer = getCustomers().find(function (c) { return c.id === customerId; });
    if (!customer) throw new Error("Select an existing customer record.");
    var requests = getRequests(), orders = getOrders();
    var req = requests.find(function (r) { return r.id === requestId; });
    if (!req) throw new Error("Print request not found.");
    // Keep names used when a request was submitted, but change its identity link.
    req.customer = Object.assign({}, req.customer, { customerId: customerId });
    if (req.orderId) {
      var order = orders.find(function (o) { return o.id === req.orderId; });
      if (order) order.customer = Object.assign({}, order.customer, { customerId: customerId });
    }
    try { saveRequests(requests); saveOrders(orders); }
    catch(error) { rollback(previous); throw error; }
    return req;
  }
  function mergeCustomers(keepId, removeId) {
    if (!keepId || !removeId || keepId === removeId) throw new Error("Choose two different records.");
    var previous = snapshot();
    var customers = getCustomers(), requests = getRequests(), orders = getOrders();
    var target = customers.find(function (c) { return c.id === keepId; });
    var duplicate = customers.find(function (c) { return c.id === removeId; });
    if (!target || !duplicate) throw new Error("A selected customer record no longer exists.");
    var aliases = [target.name].concat(target.aliases || [], duplicate.name, duplicate.aliases || []);
    var seen = new Set();
    target.aliases = aliases.filter(function (name) {
      var k = normalizedName(name);
      if (!k || k === normalizedName(target.name) || seen.has(k)) return false;
      seen.add(k); return true;
    });
    if (!target.contact && duplicate.contact) target.contact = duplicate.contact;
    target.updatedAt = new Date().toISOString();
    var linkedOrders = 0, linkedRequests = 0;
    orders.forEach(function (o) {
      if (o.customer && o.customer.customerId === removeId) {
        o.customer = Object.assign({}, o.customer, { customerId: keepId }); linkedOrders++;
      }
    });
    requests.forEach(function (r) {
      if (r.customer && r.customer.customerId === removeId) {
        r.customer = Object.assign({}, r.customer, { customerId: keepId }); linkedRequests++;
      }
    });
    customers = customers.filter(function (c) { return c.id !== removeId; });
    try { saveCustomers(customers); saveOrders(orders); saveRequests(requests); }
    catch(error) { rollback(previous); throw error; }
    return { customer: target, linkedOrders: linkedOrders, linkedRequests: linkedRequests };
  }
  function pickupCount(slot, ignoredId) {
    return getOrders().filter(function (o) {
      return o.id !== ignoredId && o.pickupSlot === slot && o.status !== "cancelled" && o.status !== "claimed";
    }).length;
  }
  function canCancel(order) { return !!order && order.status === "received"; }
  function canEdit(order) { return !!order && order.status === "received"; }
  function generateQueueNumber() {
    var prefix = app.config.queuePrefix + "-";
    var max = getOrders().reduce(function (highest, order) {
      var n = Number(String(order.queueNumber || "").replace(prefix, ""));
      return Number.isFinite(n) ? Math.max(highest, n) : highest;
    }, 0);
    return prefix + String(max + 1).padStart(3, "0");
  }
  function addOrder(draft) {
    if (draft.pickupSlot && pickupCount(draft.pickupSlot) >= SLOT_CAPACITY)
      throw new Error("This pickup slot is full. Please choose another.");
    var orders = getOrders(), now = new Date().toISOString();
    var incoming = draft.customer || {};
    var walkin = incoming.type === "walkin" || (!String(incoming.name || "").trim() && !String(incoming.contact || "").trim());
    var existing = incoming.customerId ? getCustomers().find(function (c) { return c.id === incoming.customerId; }) : null;
    var record = walkin ? null : (existing || (incoming.saveToRecords ? upsertCustomer(incoming) : null));
    var order = {
      id: app.generateId(), queueNumber: generateQueueNumber(), createdAt: now, updatedAt: now,
      customer: walkin ? {type:"walkin",name:"Walk-in Customer",contact:"",customerId:null} :
        Object.assign({}, incoming, {type:"named",customerId:(record && record.id) || incoming.customerId || null}),
      priority: draft.priority || (draft.specifications && draft.specifications.rush ? "rush" : "normal"),
      deadline: draft.deadline || "", pickupSlot: draft.pickupSlot || "",
      service: draft.service, specifications: draft.specifications, pricing: draft.pricing,
      status: "received", statusHistory: [{status:"received",timestamp:now}]
    };
    orders.unshift(order); saveOrders(orders);
    return order;
  }
  function updateOrder(orderId, changes) {
    var orders = getOrders();
    var i = orders.findIndex(function (o) { return o.id === orderId; });
    if (i < 0) return null;
    var original = orders[i];
    var updated = typeof changes === "function" ? changes(Object.assign({}, original)) : Object.assign({}, original, changes || {});
    updated.updatedAt = new Date().toISOString();
    orders[i] = updated; saveOrders(orders); return updated;
  }
  function updateStatus(orderId, status) {
    if (!app.config.statuses[status]) return null;
    var current = getOrders().find(function (o) { return o.id === orderId; });
    if (!current || (status === "cancelled" && !canCancel(current)) || ["claimed", "cancelled"].includes(current.status)) return null;
    return updateOrder(orderId, function (order) {
      order.status = status;
      order.statusHistory = (Array.isArray(order.statusHistory) ? order.statusHistory : []).concat({status:status,timestamp:new Date().toISOString()});
      return order;
    });
  }
  function updateRequest(id, changes) {
    var requests = getRequests(), i = requests.findIndex(function (r) { return r.id === id; });
    if (i < 0) return null;
    var previous = requests[i], nextStatus = changes && changes.status;
    if (nextStatus && nextStatus !== previous.status &&
        (previous.status !== "pending" || !["approved", "rejected", "cancelled"].includes(nextStatus))) return null;
    var now = new Date().toISOString();
    var events = Array.isArray(previous.events) ? previous.events.slice() : [{status:"pending",label:"Request submitted",timestamp:previous.createdAt || now}];
    if (nextStatus && nextStatus !== previous.status) {
      var labels = {approved:"Approved by staff",rejected:"Rejected by staff",cancelled:"Cancelled by customer"};
      events.push({status:nextStatus,label:labels[nextStatus],timestamp:now});
    }
    requests[i] = Object.assign({}, previous, changes, {events:events,updatedAt:now});
    saveRequests(requests); return requests[i];
  }
  function cancelRequest(id) {
    var req = getRequests().find(function (r) { return r.id === id; });
    return req && req.status === "pending" ? updateRequest(id, {status:"cancelled"}) : null;
  }

  app.storage = {
    getOrders:getOrders, saveOrders:saveOrders, getDraft:getDraft, saveDraft:saveDraft, clearDraft:clearDraft,
    getPricingRates:getPricingRates, savePricingRates:savePricingRates,
    getCustomers:getCustomers, saveCustomers:saveCustomers, upsertCustomer:upsertCustomer,
    createCustomer:createCustomer, findCustomerCandidates:findCustomerCandidates,
    addCustomerAlias:addCustomerAlias, saveCustomerRequest:saveCustomerRequest,
    ensureRequestCustomerLinks:ensureRequestCustomerLinks,
    linkRequestToCustomer:linkRequestToCustomer, mergeCustomers:mergeCustomers,
    getRequests:getRequests, saveRequests:saveRequests, updateRequest:updateRequest, cancelRequest:cancelRequest,
    pickupCount:pickupCount, slotCapacity:SLOT_CAPACITY, canCancel:canCancel, canEdit:canEdit,
    generateQueueNumber:generateQueueNumber, addOrder:addOrder, updateOrder:updateOrder, updateStatus:updateStatus
  };
})(window.PaPrint);
