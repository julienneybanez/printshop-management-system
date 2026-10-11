document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({ activePage: "backup", title: "Backup & Restore" });

  var input = document.querySelector("#restoreFile");
  var preview = document.querySelector("#backupPreview");
  var message = document.querySelector("#backupMessage");
  var restoreButton = document.querySelector("#restoreBackup");
  var selectedBackup = null;
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var CUSTOMER_KEY = "paprint_v1_customers";

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validOrder(order) {
    return isObject(order) && typeof order.id === "string" && order.id.trim() !== "" &&
      typeof order.queueNumber === "string" && order.queueNumber.trim() !== "" &&
      typeof order.status === "string" && Object.prototype.hasOwnProperty.call(PaPrint.config.statuses, order.status) &&
      (order.customer == null || isObject(order.customer)) &&
      (order.customer == null || order.customer.name == null || typeof order.customer.name === "string") &&
      (order.customer == null || order.customer.contact == null || typeof order.customer.contact === "string") &&
      isObject(order.service) && typeof order.service.id === "string" &&
      isObject(order.specifications) && isObject(order.pricing) &&
      Number.isFinite(Number(order.pricing.total));
  }

  function validCustomer(customer) {
    return isObject(customer) && typeof customer.id === "string" && customer.id.trim() !== "" &&
      typeof customer.name === "string" && customer.name.trim() !== "" &&
      (customer.contact == null || typeof customer.contact === "string");
  }

  function hasUniqueIds(entries) {
    var ids = entries.map(function (entry) { return entry.id; });
    return new Set(ids).size === ids.length;
  }

  function validateBackup(data) {
    if (!isObject(data) || data.schema !== "paprint-backup" || data.version !== 1 ||
        !Array.isArray(data.orders) || !Array.isArray(data.customers)) {
      throw new Error("Unsupported backup format. Select a PaPrint version 1 JSON backup.");
    }
    if (!data.orders.every(validOrder) || !data.customers.every(validCustomer) ||
        !hasUniqueIds(data.orders) || !hasUniqueIds(data.customers)) {
      throw new Error("Invalid backup: missing, malformed, or duplicate order/customer information.");
    }
    return data;
  }

  function isWalkin(order) {
    var customer = order.customer || {};
    return customer.type === "walkin" || !String(customer.name || "").trim();
  }

  function resetPreview(text) {
    selectedBackup = null;
    preview.hidden = true;
    message.textContent = text;
  }

  document.querySelector("#exportBackup").addEventListener("click", function () {
    var data = {
      schema: "paprint-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      orders: PaPrint.storage.getOrders(),
      customers: PaPrint.storage.getCustomers()
    };
    var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    var link = document.createElement("a");
    link.href = url;
    link.download = "paprint-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  input.addEventListener("change", async function () {
    resetPreview("Reading selected backup...");
    var file = input.files && input.files[0];
    if (!file) { resetPreview("Select a backup file to continue."); return; }
    if (file.size > MAX_FILE_SIZE) { resetPreview("Backup must be 5 MB or smaller."); return; }
    try {
      var backup = validateBackup(JSON.parse(await file.text()));
      if (!input.files || input.files[0] !== file) return;
      selectedBackup = backup;
      document.querySelector("#backupOrderCount").textContent = String(backup.orders.length);
      document.querySelector("#backupCustomerCount").textContent = String(backup.customers.length);
      document.querySelector("#backupWalkinCount").textContent = String(backup.orders.filter(isWalkin).length);
      var parsedDate = new Date(backup.exportedAt);
      document.querySelector("#backupDate").textContent = backup.exportedAt && !Number.isNaN(parsedDate.getTime()) ? PaPrint.formatDate(backup.exportedAt) : "Not recorded";
      preview.hidden = false;
      message.textContent = "Backup validated. Check the summary before restoring.";
    } catch (error) {
      resetPreview(error instanceof SyntaxError ? "This file is not valid JSON." : error.message || "Could not read backup.");
    }
  });

  restoreButton.addEventListener("click", async function () {
    if (!selectedBackup) { PaPrint.ui.toast("Select and preview a valid backup first."); return; }
    var backup = selectedBackup;
    var ok = await PaPrint.ui.confirmAction({
      title: "Replace local data?",
      message: "This will replace " + PaPrint.storage.getOrders().length + " saved orders and " + PaPrint.storage.getCustomers().length + " registered customers with " + backup.orders.length + " orders and " + backup.customers.length + " customers from the backup. Export current data first if needed.",
      confirmText: "Restore backup",
      cancelText: "Cancel",
      danger: true
    });
    if (!ok) return;
    var ordersKey = PaPrint.config.storageKeys.orders;
    var previousOrders = localStorage.getItem(ordersKey);
    var previousCustomers = localStorage.getItem(CUSTOMER_KEY);
    try {
      PaPrint.storage.saveOrders(backup.orders);
      PaPrint.storage.saveCustomers(backup.customers);
      PaPrint.ui.toast("Backup restored. Reload other open tabs to see the changes.");
      message.textContent = "Restore completed. Your local orders and customer records were replaced.";
    } catch (error) {
      try {
        if (previousOrders === null) localStorage.removeItem(ordersKey);
        else localStorage.setItem(ordersKey, previousOrders);
        if (previousCustomers === null) localStorage.removeItem(CUSTOMER_KEY);
        else localStorage.setItem(CUSTOMER_KEY, previousCustomers);
      } catch (rollbackError) {
        PaPrint.ui.toast("Restore failed and rollback may be incomplete. Check local data.");
        return;
      }
      PaPrint.ui.toast("Restore failed. Previous saved data was recovered.");
    }
  });
});
