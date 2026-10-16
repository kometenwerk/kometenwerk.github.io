/* Kometenwerk – kleine Helfer für die öffentlichen Seiten */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  // Menü auf dem Handy
  var nav = document.querySelector(".nav"), burger = document.querySelector(".burger");
  if (nav && burger) {
    burger.addEventListener("click", function () {
      var auf = !nav.classList.contains("open");
      nav.classList.toggle("open", auf);
      burger.setAttribute("aria-expanded", auf ? "true" : "false");
    });
    nav.addEventListener("click", function (e) { if (e.target.closest(".nav-links a")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); burger.focus(); } });
  }

  // Abschnitte gleiten beim Scrollen sanft ins Bild
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add("show"); });
  }

  // Jahr in der Fußzeile
  document.querySelectorAll("[data-jahr]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
