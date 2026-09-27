(function () {
    'use strict';

    var STYLE_ID = 'last-read-styles';
    var TOAST_TIMEOUT_MS = 4000;
    var STORAGE_PREFIX = 'symfony-docs-last-read:';

    // captured synchronously at load time: this script's own resolved URL, used to derive the
    // site root without relying on a <base> tag (which breaks plain "#anchor" links - see build.php)
    var CURRENT_SCRIPT_SRC = document.currentScript ? document.currentScript.src : null;

    function siteRootUrl() {
        var marker = 'assets/js/last-read.js';
        var idx = CURRENT_SCRIPT_SRC ? CURRENT_SCRIPT_SRC.indexOf(marker) : -1;

        return -1 === idx ? null : CURRENT_SCRIPT_SRC.slice(0, idx);
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.last-read-status {',
            '    display: inline-flex;',
            '    align-items: center;',
            '    gap: 0.4em;',
            '    margin: 0.5em 0 1.5em;',
            '    padding: 0.35em 0.9em;',
            '    border-radius: 999px;',
            '    background: #e6f6ec;',
            '    color: #1f7a41;',
            '    font-weight: 600;',
            '    font-size: 0.9em;',
            '    transition: background-color 0.3s ease;',
            '}',
            '.last-read-status.last-read-status--pulse {',
            '    animation: last-read-pulse 0.6s ease;',
            '}',
            '@keyframes last-read-pulse {',
            '    0% { background-color: #b8ecc9; }',
            '    100% { background-color: #e6f6ec; }',
            '}',
            '.last-read-actions {',
            '    display: flex;',
            '    flex-wrap: wrap;',
            '    justify-content: center;',
            '    gap: 0.75em;',
            '    margin: 2.5em 0 1em;',
            '}',
            '.last-read-btn {',
            '    display: inline-flex;',
            '    align-items: center;',
            '    gap: 0.5em;',
            '    padding: 0.65em 1.3em;',
            '    border: none;',
            '    border-radius: 6px;',
            '    font-size: 0.95em;',
            '    font-weight: 600;',
            '    cursor: pointer;',
            '    transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.15s ease;',
            '    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);',
            '}',
            '.last-read-btn:hover {',
            '    transform: translateY(-1px);',
            '    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);',
            '}',
            '.last-read-btn:active {',
            '    transform: translateY(0);',
            '    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);',
            '}',
            '.last-read-btn--read {',
            '    background-color: #2fa365;',
            '    color: #fff;',
            '}',
            '.last-read-btn--read:hover {',
            '    background-color: #278a56;',
            '}',
            '.last-read-btn--unread {',
            '    background-color: #f1f1f1;',
            '    color: #55606c;',
            '}',
            '.last-read-btn--unread:hover {',
            '    background-color: #e3e5e8;',
            '}',
            '.last-read-btn--home {',
            '    background-color: #2980b9;',
            '    color: #fff;',
            '    text-decoration: none;',
            '}',
            '.last-read-btn--home:hover {',
            '    background-color: #24709f;',
            '}',
            '.last-read-toast {',
            '    position: fixed;',
            '    left: 50%;',
            '    bottom: 1.5em;',
            '    z-index: 9999;',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 1em;',
            '    padding: 0.8em 1em 0.8em 1.2em;',
            '    border-radius: 10px;',
            '    background: #2b2f36;',
            '    color: #fff;',
            '    font-size: 0.9em;',
            '    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);',
            '    opacity: 0;',
            '    pointer-events: none;',
            '    transform: translate(-50%, 12px);',
            '    transition: opacity 0.25s ease, transform 0.25s ease;',
            '}',
            '.last-read-toast.last-read-toast--visible {',
            '    opacity: 1;',
            '    pointer-events: auto;',
            '    transform: translate(-50%, 0);',
            '}',
            '.last-read-toast__message {',
            '    white-space: nowrap;',
            '}',
            'a.link-read::after {',
            '    content: " ✅";',
            '    font-size: 0.85em;',
            '}',
            '.reading-progress {',
            '    display: flex;',
            '    flex-wrap: wrap;',
            '    align-items: center;',
            '    gap: 0.75em;',
            '    margin: 0.5em 0 1.8em;',
            '    font-weight: 600;',
            '    font-size: 0.95em;',
            '}',
            '.reading-progress-bar {',
            '    flex: 1 1 auto;',
            '    max-width: 220px;',
            '    height: 10px;',
            '    border-radius: 999px;',
            '    background: #e1e4e5;',
            '    overflow: hidden;',
            '}',
            '.reading-progress-bar-fill {',
            '    height: 100%;',
            '    background: linear-gradient(90deg, #2fa365, #4cc484);',
            '    border-radius: 999px;',
            '    transition: width 0.4s ease;',
            '}'
        ].join('\n');

        document.head.appendChild(style);
    }

    function formatDate(date) {
        var day = String(date.getDate()).padStart(2, '0');
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var year = date.getFullYear();

        return day + '/' + month + '/' + year;
    }

    function storageKey() {
        return STORAGE_PREFIX + window.location.pathname;
    }

    // every page's read status lives in the same origin's localStorage, so any page
    // can read the whole set and mark, in its own nav/content links, which ones were read
    function readPagePaths() {
        var paths = {};
        for (var i = 0; i < window.localStorage.length; i++) {
            var key = window.localStorage.key(i);
            if (key && 0 === key.indexOf(STORAGE_PREFIX)) {
                paths[key.slice(STORAGE_PREFIX.length)] = true;
            }
        }

        return paths;
    }

    function decorateReadLinks() {
        var readPaths = readPagePaths();
        var links = document.querySelectorAll('.wy-menu-vertical a[href], .rst-content a[href]');

        links.forEach(function (link) {
            var rawHref = link.getAttribute('href');
            if (!rawHref || '#' === rawHref.charAt(0)) {
                return;
            }

            var url;
            try {
                url = new URL(link.href);
            } catch (e) {
                return;
            }

            if (url.origin !== window.location.origin) {
                return;
            }

            link.classList.toggle('link-read', !!readPaths[url.pathname]);
        });
    }

    // home page only: X/total pages read, as a count + percentage bar
    function renderReadingProgress() {
        var container = document.getElementById('reading-progress');
        if (!container) {
            return;
        }

        var total = parseInt(container.getAttribute('data-total'), 10) || 0;
        var readCount = Object.keys(readPagePaths()).length;
        var percent = total > 0 ? Math.round((readCount / total) * 100) : 0;

        var textEl = document.getElementById('reading-progress-text');
        var percentEl = document.getElementById('reading-progress-percent');
        var fillEl = document.getElementById('reading-progress-bar-fill');

        if (textEl) {
            textEl.textContent = readCount + '/' + total + ' read';
        }
        if (percentEl) {
            percentEl.textContent = percent + '%';
        }
        if (fillEl) {
            fillEl.style.width = percent + '%';
        }
    }

    function createToast() {
        var toast = document.getElementById('last-read-toast');
        if (toast) {
            return toast;
        }

        toast = document.createElement('div');
        toast.id = 'last-read-toast';
        toast.className = 'last-read-toast';

        var message = document.createElement('span');
        message.className = 'last-read-toast__message';
        toast.appendChild(message);

        document.body.appendChild(toast);

        return toast;
    }

    function hideToast(toast) {
        toast.classList.remove('last-read-toast--visible');
        window.clearTimeout(toast._hideTimer);
    }

    function showToast(text) {
        var toast = createToast();
        toast.querySelector('.last-read-toast__message').textContent = text;

        // restart the fade-in even if the toast is already visible
        toast.classList.remove('last-read-toast--visible');
        // eslint-disable-next-line no-unused-expressions
        toast.offsetHeight;
        toast.classList.add('last-read-toast--visible');

        window.clearTimeout(toast._hideTimer);
        toast._hideTimer = window.setTimeout(function () {
            hideToast(toast);
        }, TOAST_TIMEOUT_MS);
    }

    document.addEventListener('DOMContentLoaded', function () {
        decorateReadLinks();
        renderReadingProgress();

        var content = document.querySelector('[itemprop="articleBody"]');
        if (!content) {
            return;
        }

        var heading = content.querySelector('h1');
        if (!heading) {
            return;
        }

        injectStyles();

        var status = document.getElementById('last-read-status');
        if (!status) {
            status = document.createElement('p');
            status.id = 'last-read-status';
            status.className = 'last-read-status';
            heading.insertAdjacentElement('afterend', status);
        }

        var actions = document.getElementById('last-read-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.id = 'last-read-actions';
            actions.className = 'last-read-actions';
            content.appendChild(actions);
        }

        var unreadButton = document.getElementById('mark-as-unread-button');
        if (!unreadButton) {
            unreadButton = document.createElement('button');
            unreadButton.id = 'mark-as-unread-button';
            unreadButton.type = 'button';
            unreadButton.className = 'last-read-btn last-read-btn--unread';
            unreadButton.innerHTML = '↩️ Mark as unread';
            actions.appendChild(unreadButton);
        }

        var readButton = document.getElementById('mark-as-read-button');
        if (!readButton) {
            readButton = document.createElement('button');
            readButton.id = 'mark-as-read-button';
            readButton.type = 'button';
            readButton.className = 'last-read-btn last-read-btn--read';
            readButton.innerHTML = '✅ Mark as read';
            actions.appendChild(readButton);
        }

        // "Back to home" gets its own row, always below the read/unread row, on every page but the home page itself
        var isHomePage = !!document.getElementById('symfony-documentation');
        var homeActions = document.getElementById('back-to-home-actions');
        if (!isHomePage && !homeActions) {
            homeActions = document.createElement('div');
            homeActions.id = 'back-to-home-actions';
            homeActions.className = 'last-read-actions';
            content.appendChild(homeActions);

            var homeButton = document.createElement('a');
            homeButton.id = 'back-to-home-button';
            var root = siteRootUrl();
            homeButton.href = (null !== root ? root : '') + 'index.html';
            homeButton.className = 'last-read-btn last-read-btn--home';
            homeButton.innerHTML = '🏠 Back to home';
            homeActions.appendChild(homeButton);
        }

        function render() {
            var timestamp = window.localStorage.getItem(storageKey());
            if (timestamp) {
                status.textContent = 'Last read at ' + formatDate(new Date(timestamp)) + ' ✅';
                status.style.display = '';
            } else {
                status.textContent = '';
                status.style.display = 'none';
            }
        }

        function pulseStatus() {
            status.classList.remove('last-read-status--pulse');
            // eslint-disable-next-line no-unused-expressions
            status.offsetHeight;
            status.classList.add('last-read-status--pulse');
        }

        readButton.addEventListener('click', function () {
            window.localStorage.setItem(storageKey(), new Date().toISOString());
            render();
            pulseStatus();
            decorateReadLinks();
            renderReadingProgress();
            showToast('✅ Page marked as read');
        });

        unreadButton.addEventListener('click', function () {
            window.localStorage.removeItem(storageKey());
            render();
            decorateReadLinks();
            renderReadingProgress();
            showToast('↩️ Page marked as unread');
        });

        render();
    });

    // keep nav/content link markers and the reading-progress indicator in sync if another
    // tab on this site marks a page read/unread
    window.addEventListener('storage', function (event) {
        if (event.key && 0 === event.key.indexOf(STORAGE_PREFIX)) {
            decorateReadLinks();
            renderReadingProgress();
        }
    });
})();
