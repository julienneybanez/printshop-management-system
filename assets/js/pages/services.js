document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  PaPrint.ui.initShell({
    activePage: "services",
    title: "Services"
  });

  var grid = document.querySelector("[data-service-grid]");
  var search = document.querySelector("#serviceSearch");
  var category = document.querySelector("#serviceCategory");

  function render() {
    var term = search.value.trim().toLowerCase();
    var selectedCategory = category.value;

    var services = PaPrint.config.services.filter(function (service) {
      var matchesTerm = !term ||
        (service.name + " " + service.description).toLowerCase().includes(term);

      var matchesCategory = selectedCategory === "all" ||
        service.category === selectedCategory;

      return matchesTerm && matchesCategory;
    });

    if (!services.length) {
      grid.innerHTML =
        '<div class="card empty-state"><h2>No services found.</h2></div>';
      return;
    }

    grid.innerHTML = services.map(function (service) {
      return (
        '<article class="card service-card">' +
          '<div class="service-icon" aria-hidden="true">' + PaPrint.escapeHTML(service.icon) + "</div>" +
          "<div>" +
            "<h2>" + PaPrint.escapeHTML(service.name) + "</h2>" +
            "<p>" + PaPrint.escapeHTML(service.description) + "</p>" +
          "</div>" +
          '<div class="service-price">Starts at ' +
            PaPrint.escapeHTML(PaPrint.formatMoney(service.startingPrice)) +
            " per " + PaPrint.escapeHTML(service.unit) +
          "</div>" +
          '<a class="btn btn-primary" href="new-job.html?service=' +
            encodeURIComponent(service.id) +
          '">Create Job</a>' +
        "</article>"
      );
    }).join("");
  }

  search.addEventListener("input", render);
  category.addEventListener("change", render);

  render();
});
