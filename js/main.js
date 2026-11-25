(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Mobile navigation toggle
  var toggle = document.querySelector(".nav-toggle");
  var navList = document.querySelector(".nav-list");

  if (toggle && navList) {
    toggle.addEventListener("click", function () {
      var isOpen = navList.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navList.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navList.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navList.classList.contains("is-open")) {
        navList.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // Current-year footer stamp
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Copy email: clipboard with a short text confirmation; falls back to mailto
  document.querySelectorAll(".copy-email").forEach(function (btn) {
    var status = btn.parentNode.querySelector(".copy-status");
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      var email = btn.getAttribute("data-email");
      var done = function () {
        btn.textContent = "Copied";
        if (status) status.textContent = "Email address copied to the clipboard.";
        setTimeout(function () {
          btn.textContent = label;
          if (status) status.textContent = "";
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, function () { window.location.href = "mailto:" + email; });
      } else {
        window.location.href = "mailto:" + email;
      }
    });
  });

  // Project cards below the fold rise in once as they scroll into view.
  // Cards already on screen are never hidden; nothing happens without
  // IntersectionObserver or when the visitor prefers reduced motion.
  if (!reduceMotion && "IntersectionObserver" in window) {
    var cards = Array.prototype.filter.call(document.querySelectorAll(".proj"), function (c) {
      return c.getBoundingClientRect().top > window.innerHeight;
    });
    if (cards.length) {
      cards.forEach(function (c) { c.classList.add("is-pending"); });
      var io = new IntersectionObserver(function (entries) {
        var batch = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.style.transitionDelay = Math.min(batch, 2) * 60 + "ms";
          batch += 1;
          entry.target.classList.remove("is-pending");
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      cards.forEach(function (c) { io.observe(c); });
    }
  }

  // Case-study contents bar: built from the page's own section headings,
  // sticky under the header, with the section being read marked.
  var hero = document.querySelector("main .page-hero");
  var sections = Array.prototype.filter.call(document.querySelectorAll("main section[id]"), function (s) {
    return s.querySelector(".section-head h2");
  });
  if (hero && sections.length >= 4) {
    var header = document.querySelector(".site-header");
    var headerH = header ? header.offsetHeight : 0;
    document.documentElement.style.setProperty("--toc-top", headerH + "px");

    var nav = document.createElement("nav");
    nav.className = "toc";
    nav.setAttribute("aria-label", "On this page");
    var wrap = document.createElement("div");
    wrap.className = "wrap";
    var ol = document.createElement("ol");
    var links = {};
    sections.forEach(function (s) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + s.id;
      a.textContent = s.querySelector(".section-head h2").textContent.replace(/\s+/g, " ").trim();
      li.appendChild(a);
      ol.appendChild(li);
      links[s.id] = a;
    });
    wrap.appendChild(ol);
    nav.appendChild(wrap);
    hero.parentNode.insertBefore(nav, hero.nextSibling);
    document.documentElement.classList.add("has-toc");

    if ("IntersectionObserver" in window) {
      var current = null;
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var a = links[entry.target.id];
          if (current === a) return;
          if (current) current.removeAttribute("aria-current");
          a.setAttribute("aria-current", "true");
          current = a;
          var left = a.offsetLeft - 24;
          if (ol.scrollTo) ol.scrollTo({ left: left, behavior: reduceMotion ? "auto" : "smooth" });
          else ol.scrollLeft = left;
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      sections.forEach(function (s) { spy.observe(s); });
    }
  }
})();
