document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "review",
    title: "Order Review"
  });

  var host = document.querySelector("[data-review-host]");
  var draft = PaPrint.storage.getDraft();

  if (!draft) {
    host.innerHTML =
      '<section class="card empty-state">' +
        "<h2>No print job to review.</h2>" +
        '<a class="btn btn-primary" href="new-job.html" style="margin-top:12px">Create Print Job</a>' +
      "</section>";
    return;
  }

  var rows = PaPrint.specificationRows(draft);

  host.innerHTML =
    '<div class="review-layout">' +
      '<div class="review-sections">' +
        '<section class="card card-pad">' +
          '<div class="section-heading">' +
            "<h2>Customer</h2>" +
            '<a class="btn btn-neutral btn-sm" href="new-job.html?edit=1">Edit</a>' +
          "</div>" +
          '<div class="review-grid">' +
            '<div class="review-item"><span>Customer name</span><strong>' +
              PaPrint.escapeHTML(draft.customer.name) +
            "</strong></div>" +
            '<div class="review-item"><span>Contact</span><strong>' +
              PaPrint.escapeHTML(draft.customer.contact) +
            "</strong></div>" +
          "</div>" +
        "</section>" +

        '<section class="card card-pad">' +
          '<div class="section-heading"><h2>Print specifications</h2></div>' +
          '<div class="review-grid">' +
            rows.map(function (row) {
              return (
                '<div class="review-item">' +
                  "<span>" + PaPrint.escapeHTML(row[0]) + "</span>" +
                  "<strong>" + PaPrint.escapeHTML(row[1]) + "</strong>" +
                "</div>"
              );
            }).join("") +
            (draft.specifications.notes
              ? '<div class="review-item review-notes"><span>Notes</span><strong>' +
                  PaPrint.escapeHTML(draft.specifications.notes) +
                "</strong></div>"
              : "") +
          "</div>" +
        "</section>" +
      "</div>" +

      '<aside class="card card-pad review-summary">' +
        '<div class="section-heading"><h2>Order summary</h2></div>' +
        '<div class="summary-row"><span>Service</span><strong>' +
          PaPrint.escapeHTML(PaPrint.formatMoney(draft.pricing.basePrice)) +
        "</strong></div>" +
        '<div class="summary-row"><span>Finishing</span><strong>' +
          PaPrint.escapeHTML(PaPrint.formatMoney(draft.pricing.finishingFee)) +
        "</strong></div>" +
        '<div class="summary-row"><span>Rush fee</span><strong>' +
          PaPrint.escapeHTML(PaPrint.formatMoney(draft.pricing.rushFee)) +
        "</strong></div>" +
        '<div class="summary-row"><span>Total</span><strong class="total">' +
          PaPrint.escapeHTML(PaPrint.formatMoney(draft.pricing.total)) +
        "</strong></div>" +
        '<button class="btn btn-primary" type="button" data-submit-order style="width:100%;margin-top:16px">Confirm & Submit</button>' +
        '<a class="btn btn-neutral" href="new-job.html?edit=1" style="width:100%;margin-top:8px">Back to Edit</a>' +
      "</aside>" +
    "</div>";

  var submitButton = document.querySelector("[data-submit-order]");
  var submitting = false;

  submitButton.addEventListener("click", function () {
    if (submitting) return;

    submitting = true;
    submitButton.disabled = true;

    var order = PaPrint.storage.addOrder(draft);
    PaPrint.storage.clearDraft();

    window.location.href =
      "queue.html?created=" + encodeURIComponent(order.queueNumber);
  });
});
