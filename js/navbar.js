(function () {
  "use strict";

  function cleanPublicRoutes() {
    document.querySelectorAll('a[href]').forEach(function (link) {
      var rawHref = link.getAttribute('href');
      if (!rawHref || /^(?:https?:|mailto:|tel:|#)/i.test(rawHref)) return;
      link.setAttribute('href', rawHref.replace(/\.html(?=([?#]|$))/, ''));
    });

    if (/\.html$/.test(window.location.pathname)) {
      var cleanPath = window.location.pathname.replace(/\.html$/, '');
      window.history.replaceState(window.history.state, '', cleanPath + window.location.search + window.location.hash);
    }
  }

  function installNavbar() {
    cleanPublicRoutes();
    if (document.querySelector(".sigma-cabecalho-fixo")) return;

    fetch("cabecalho_fragment.html", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Falha ao carregar a navbar SIGMA-PLI");
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelector(".govsp-topo")?.remove();

        doc.querySelectorAll("style").forEach(function (style) {
          document.head.appendChild(document.adoptNode(style));
        });
        var compactHubStyle = document.createElement("style");
        compactHubStyle.textContent = '.csch2-navbar__link[href*="/pli-hub/"] .csch2-icon-svg{display:none!important}.csch2-navbar__link[href*="/pli-hub/"]{gap:0!important}';
        document.head.appendChild(compactHubStyle);

        var main = document.querySelector("main");
        var wrapper = doc.querySelector(".sigma-cabecalho-fixo");
        var spacer = doc.querySelector(".sigma-cabecalho-espacador");
        if (main && wrapper) {
          main.before(document.adoptNode(wrapper));
          if (spacer) main.before(document.adoptNode(spacer));
        }

        doc.querySelectorAll("script").forEach(function (oldScript) {
          var script = document.createElement("script");
          script.textContent = oldScript.textContent;
          document.body.appendChild(script);
        });
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installNavbar);
  } else {
    installNavbar();
  }
}());
