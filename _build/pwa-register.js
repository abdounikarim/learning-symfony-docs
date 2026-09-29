(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) {
        return;
    }

    // same site-root-detection trick as last-read.js: derive the path back to the site root
    // from this script's own resolved URL, since GitHub Pages serves the site from a subpath
    // (e.g. /learning-symfony-docs/) rather than the domain root.
    var CURRENT_SCRIPT_SRC = document.currentScript ? document.currentScript.src : null;
    var marker = 'assets/js/pwa-register.js';
    var idx = CURRENT_SCRIPT_SRC ? CURRENT_SCRIPT_SRC.indexOf(marker) : -1;
    var siteRoot = -1 === idx ? null : CURRENT_SCRIPT_SRC.slice(0, idx);

    if (!siteRoot) {
        return;
    }

    window.addEventListener('load', function () {
        navigator.serviceWorker.register(siteRoot + 'sw.js', { scope: siteRoot }).catch(function () {});
    });
})();
