'use strict';

// __CACHE_VERSION__ and __PRECACHE_URLS__ are substituted by build.php at build time.
// The cache name changes on every build, so a new deploy always gets a fresh cache and
// the old one is dropped on activate - no manual cache-busting needed.
var CACHE_VERSION = '__CACHE_VERSION__';
var CACHE_NAME = 'symfony-docs-' + CACHE_VERSION;
var PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', function (event) {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            // cache.addAll() aborts entirely if a single URL 404s; add one by one instead
            // so one missing/renamed asset doesn't sink the whole offline precache.
            return Promise.all(
                PRECACHE_URLS.map(function (url) {
                    return cache.add(url).catch(function () {});
                })
            );
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (name) {
                        return name.indexOf('symfony-docs-') === 0 && name !== CACHE_NAME;
                    })
                    .map(function (name) {
                        return caches.delete(name);
                    })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;

    if ('GET' !== request.method || request.url.indexOf(self.location.origin) !== 0) {
        return;
    }

    event.respondWith(
        caches.match(request).then(function (cached) {
            var network = fetch(request).then(function (response) {
                if (response && 200 === response.status) {
                    var responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(request, responseClone);
                    });
                }

                return response;
            }).catch(function () {
                // offline and not cached: for page navigations, fall back to the home page
                // rather than a hard connection error
                if (cached) {
                    return cached;
                }

                if ('navigate' === request.mode) {
                    return caches.match('index.html');
                }

                return Promise.reject('offline and not cached');
            });

            return cached || network;
        })
    );
});
