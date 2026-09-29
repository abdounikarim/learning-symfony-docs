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

    // build-time map of every page's own outgoing internal links (see build.php), used so a
    // link's badge can show the LINKED page's own read/total link counts, not the current page's
    var PAGE_LINKS_MANIFEST_PATH = 'assets/js/page-links.json';
    var pageLinksManifest = null;
    var pageLinksManifestPromise = null;

    function siteRootPathname() {
        var root = siteRootUrl();
        if (!root) {
            return null;
        }
        try {
            return new URL(root).pathname;
        } catch (e) {
            return null;
        }
    }

    function loadPageLinksManifest() {
        if (pageLinksManifestPromise) {
            return pageLinksManifestPromise;
        }

        var root = siteRootUrl();
        if (!root) {
            return Promise.resolve({});
        }

        pageLinksManifestPromise = fetch(root + PAGE_LINKS_MANIFEST_PATH)
            .then(function (response) {
                return response.ok ? response.json() : {};
            })
            .catch(function () {
                return {};
            })
            .then(function (data) {
                pageLinksManifest = data;

                return data;
            });

        return pageLinksManifestPromise;
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
            '.page-nav-actions {',
            '    display: flex;',
            '    flex-wrap: wrap;',
            '    justify-content: center;',
            '    align-items: center;',
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
            '.last-read-btn--nav {',
            '    background-color: transparent;',
            '    color: inherit;',
            '    text-decoration: none;',
            '    padding: 0.4em 0.6em;',
            '    font-size: 1.3em;',
            '    line-height: 1;',
            '    box-shadow: none;',
            '}',
            '.last-read-btn--nav:hover {',
            '    background-color: rgba(127, 127, 127, 0.15);',
            '    box-shadow: none;',
            '}',
            '.last-read-btn--nav:active {',
            '    box-shadow: none;',
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
            'a.link-has-badge::after {',
            '    content: " " attr(data-badge);',
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
            '.notes-total {',
            '    font-weight: 600;',
            '    font-size: 0.95em;',
            '    margin: 0 0 1.8em;',
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
            '}',
            '.page-notes {',
            '    margin: 0.5em 0 1.8em;',
            '}',
            '.page-notes-form {',
            '    display: none;',
            '    flex-direction: column;',
            '    gap: 0.5em;',
            '    margin-bottom: 1em;',
            '}',
            '.page-notes-form.page-notes-form--visible {',
            '    display: flex;',
            '}',
            '.page-notes-form textarea {',
            '    width: 100%;',
            '    min-height: 4.5em;',
            '    padding: 0.6em;',
            '    border: 1px solid #c9ccd1;',
            '    border-radius: 6px;',
            '    font: inherit;',
            '    color: inherit;',
            '    background: transparent;',
            '    resize: vertical;',
            '    box-sizing: border-box;',
            '}',
            '.page-notes-form button {',
            '    align-self: flex-end;',
            '}',
            '.page-note {',
            '    background: #fff8db;',
            '    border-left: 3px solid #f0c419;',
            '    color: #6b5b0f;',
            '    padding: 0.6em 0.9em;',
            '    margin-bottom: 0.6em;',
            '    border-radius: 4px;',
            '    font-size: 0.95em;',
            '    display: flex;',
            '    align-items: flex-start;',
            '    justify-content: space-between;',
            '    gap: 0.75em;',
            '}',
            '.page-note__text {',
            '    white-space: pre-wrap;',
            '    flex: 1 1 auto;',
            '}',
            '.page-note__remove {',
            '    flex: 0 0 auto;',
            '    background: transparent;',
            '    color: inherit;',
            '    border: none;',
            '    cursor: pointer;',
            '    font-size: 1em;',
            '    line-height: 1;',
            '    padding: 0.15em 0.35em;',
            '    border-radius: 4px;',
            '    opacity: 0.7;',
            '}',
            '.page-note__remove:hover {',
            '    opacity: 1;',
            '    background: rgba(0, 0, 0, 0.08);',
            '}',
            '.page-note__remove--confirm {',
            '    background: rgba(220, 53, 69, 0.15);',
            '    color: #dc3545;',
            '    opacity: 1;',
            '}',
            '.page-note__remove--confirm:hover {',
            '    background: rgba(220, 53, 69, 0.25);',
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

    // free-text notes, specific to the current page, persisted like the read status so they
    // survive across sessions; a page can have any number of them
    var NOTES_PREFIX = 'symfony-docs-notes:';

    function notesStorageKey() {
        return NOTES_PREFIX + window.location.pathname;
    }

    function readNotes() {
        try {
            var parsed = JSON.parse(window.localStorage.getItem(notesStorageKey()));

            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeNotes(notes) {
        window.localStorage.setItem(notesStorageKey(), JSON.stringify(notes));
    }

    function renderNotesList() {
        var list = document.getElementById('page-notes-list');
        if (!list) {
            return;
        }

        list.innerHTML = '';
        readNotes().forEach(function (note, index) {
            var item = document.createElement('div');
            item.className = 'page-note';

            var text = document.createElement('span');
            text.className = 'page-note__text';
            text.textContent = note;
            item.appendChild(text);

            var removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'page-note__remove';
            removeButton.innerHTML = '🗑️';
            removeButton.setAttribute('aria-label', 'Remove this note');
            removeButton.title = 'Remove this note';
            removeButton.addEventListener('click', function () {
                // first click arms a confirmation (auto-reverts after a few seconds);
                // only the second click, while armed, actually removes the note
                if (!removeButton.classList.contains('page-note__remove--confirm')) {
                    removeButton.classList.add('page-note__remove--confirm');
                    removeButton.innerHTML = '❓';
                    removeButton.title = 'Click again to confirm removal';
                    removeButton.setAttribute('aria-label', 'Click again to confirm removal');
                    window.clearTimeout(removeButton._confirmTimer);
                    removeButton._confirmTimer = window.setTimeout(function () {
                        removeButton.classList.remove('page-note__remove--confirm');
                        removeButton.innerHTML = '🗑️';
                        removeButton.title = 'Remove this note';
                        removeButton.setAttribute('aria-label', 'Remove this note');
                    }, 3000);

                    return;
                }

                window.clearTimeout(removeButton._confirmTimer);
                var notes = readNotes();
                notes.splice(index, 1);
                writeNotes(notes);
                renderNotesList();
                decorateLinks();
                renderNotesTotal();
                showToast('🗑️ Note removed');
            });
            item.appendChild(removeButton);

            list.appendChild(item);
        });
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

    // same idea, but the number of notes saved on each page
    function readAllNotesCounts() {
        var counts = {};
        for (var i = 0; i < window.localStorage.length; i++) {
            var key = window.localStorage.key(i);
            if (key && 0 === key.indexOf(NOTES_PREFIX)) {
                try {
                    var notes = JSON.parse(window.localStorage.getItem(key));
                    if (Array.isArray(notes) && notes.length > 0) {
                        counts[key.slice(NOTES_PREFIX.length)] = notes.length;
                    }
                } catch (e) {
                    // ignore malformed entries
                }
            }
        }

        return counts;
    }

    // decorates every nav/content link with a "✅"/"📝<count>" badge when the page it points to
    // has been read and/or has notes on it, plus "<read>/<total>" counting how many of THAT
    // linked page's own internal links point to pages already read - a per-link fact (each link
    // on the page can show a different pair, based on where it points), not a page-level one
    function decorateLinks() {
        if (!pageLinksManifest) {
            loadPageLinksManifest().then(decorateLinks);

            return;
        }

        var readPaths = readPagePaths();
        var noteCounts = readAllNotesCounts();
        var rootPathname = siteRootPathname() || '/';
        // :not(.last-read-btn) excludes our own injected chrome (back-to-home, previous, next) -
        // those live inside .rst-content too (appended to the same content container), but they're
        // navigation UI, not actual document links, and shouldn't count as part of the page's content
        var links = document.querySelectorAll('.wy-menu-vertical a[href]:not(.last-read-btn), .rst-content a[href]:not(.last-read-btn)');

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

            var badge = [];
            if (readPaths[url.pathname]) {
                badge.push('✅');
            }
            if (noteCounts[url.pathname]) {
                badge.push('📝' + noteCounts[url.pathname]);
            }

            // manifest keys are site-root-relative (e.g. "quick_tour/flex_recipes.html"),
            // independent of where the site is actually deployed - strip that deployed prefix
            // off this link's own pathname to look its target page up in the manifest
            var targetRelativePath = 0 === url.pathname.indexOf(rootPathname)
                ? url.pathname.slice(rootPathname.length)
                : url.pathname.replace(/^\//, '');
            var targetOwnLinks = pageLinksManifest[targetRelativePath];
            if (targetOwnLinks && targetOwnLinks.length > 0) {
                var targetReadCount = targetOwnLinks.filter(function (relativePath) {
                    return !!readPaths[rootPathname + relativePath];
                }).length;
                badge.push(targetReadCount + '/' + targetOwnLinks.length);
            }

            if (badge.length > 0) {
                link.classList.add('link-has-badge');
                link.setAttribute('data-badge', badge.join(' '));
            } else {
                link.classList.remove('link-has-badge');
                link.removeAttribute('data-badge');
            }
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

    // home page only: total number of notes saved across the whole site
    function renderNotesTotal() {
        var progress = document.getElementById('reading-progress');
        if (!progress) {
            return;
        }

        var totalEl = document.getElementById('notes-total');
        if (!totalEl) {
            totalEl = document.createElement('p');
            totalEl.id = 'notes-total';
            totalEl.className = 'notes-total';
            progress.insertAdjacentElement('afterend', totalEl);
        }

        var counts = readAllNotesCounts();
        var total = Object.keys(counts).reduce(function (sum, key) {
            return sum + counts[key];
        }, 0);

        totalEl.textContent = total > 0 ? '📝 ' + total + ' note' + (1 === total ? '' : 's') + ' across the site' : '';
        totalEl.style.display = total > 0 ? '' : 'none';
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
        decorateLinks();
        renderReadingProgress();
        renderNotesTotal();

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

        // notes block: sits right after the title (and the "last read" date, if shown)
        var notesForm = document.getElementById('page-notes-form');
        if (!notesForm) {
            var notesBlock = document.createElement('div');
            notesBlock.id = 'page-notes';
            notesBlock.className = 'page-notes';
            status.insertAdjacentElement('afterend', notesBlock);

            notesForm = document.createElement('form');
            notesForm.id = 'page-notes-form';
            notesForm.className = 'page-notes-form';

            var notesTextarea = document.createElement('textarea');
            notesTextarea.id = 'page-notes-textarea';
            notesTextarea.placeholder = 'Type your note…';
            notesForm.appendChild(notesTextarea);

            var notesSubmit = document.createElement('button');
            notesSubmit.type = 'submit';
            notesSubmit.className = 'last-read-btn last-read-btn--read';
            notesSubmit.innerHTML = '📝 Save note';
            notesForm.appendChild(notesSubmit);

            notesBlock.appendChild(notesForm);

            var notesList = document.createElement('div');
            notesList.id = 'page-notes-list';
            notesBlock.appendChild(notesList);

            notesForm.addEventListener('submit', function (event) {
                event.preventDefault();
                var text = notesTextarea.value.trim();
                if (!text) {
                    return;
                }

                var notes = readNotes();
                notes.push(text);
                writeNotes(notes);
                notesTextarea.value = '';
                notesForm.classList.remove('page-notes-form--visible');
                renderNotesList();
                decorateLinks();
                renderNotesTotal();
                showToast('📝 Note added');
            });
        }

        renderNotesList();

        // single row: note - home (unless this IS home) - mark as read/unread (state-dependent icon)
        var isHomePage = !!document.getElementById('symfony-documentation');
        var navActions = document.getElementById('page-nav-actions');
        if (!navActions) {
            navActions = document.createElement('div');
            navActions.id = 'page-nav-actions';
            navActions.className = 'page-nav-actions';
            content.appendChild(navActions);

            var noteButton = document.createElement('button');
            noteButton.id = 'page-note-button';
            noteButton.type = 'button';
            noteButton.className = 'last-read-btn last-read-btn--nav';
            noteButton.innerHTML = '📝';
            noteButton.setAttribute('aria-label', 'Add a note');
            noteButton.title = 'Add a note';
            noteButton.addEventListener('click', function () {
                var form = document.getElementById('page-notes-form');
                if (!form) {
                    return;
                }

                var isVisible = form.classList.toggle('page-notes-form--visible');
                if (isVisible) {
                    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    var textarea = document.getElementById('page-notes-textarea');
                    if (textarea) {
                        textarea.focus();
                    }
                }
            });
            navActions.appendChild(noteButton);

            if (!isHomePage) {
                var homeButton = document.createElement('a');
                homeButton.id = 'back-to-home-button';
                var root = siteRootUrl();
                homeButton.href = (null !== root ? root : '') + 'index.html';
                homeButton.className = 'last-read-btn last-read-btn--nav';
                homeButton.innerHTML = '🏠';
                homeButton.setAttribute('aria-label', 'Back to home');
                homeButton.title = 'Back to home';
                navActions.appendChild(homeButton);
            }
        }

        var toggleReadButton = document.getElementById('toggle-read-button');
        if (!toggleReadButton) {
            toggleReadButton = document.createElement('button');
            toggleReadButton.id = 'toggle-read-button';
            toggleReadButton.type = 'button';
            toggleReadButton.className = 'last-read-btn last-read-btn--nav';
            navActions.appendChild(toggleReadButton);
        }

        function render() {
            var timestamp = window.localStorage.getItem(storageKey());
            if (timestamp) {
                status.textContent = 'Last read at ' + formatDate(new Date(timestamp)) + ' ✅';
                status.style.display = '';
                toggleReadButton.innerHTML = '↩️';
                toggleReadButton.setAttribute('aria-label', 'Mark as unread');
                toggleReadButton.title = 'Mark as unread';
            } else {
                status.textContent = '';
                status.style.display = 'none';
                toggleReadButton.innerHTML = '✅';
                toggleReadButton.setAttribute('aria-label', 'Mark as read');
                toggleReadButton.title = 'Mark as read';
            }
        }

        function pulseStatus() {
            status.classList.remove('last-read-status--pulse');
            // eslint-disable-next-line no-unused-expressions
            status.offsetHeight;
            status.classList.add('last-read-status--pulse');
        }

        toggleReadButton.addEventListener('click', function () {
            if (window.localStorage.getItem(storageKey())) {
                window.localStorage.removeItem(storageKey());
                render();
                decorateLinks();
                renderReadingProgress();
                showToast('↩️ Page marked as unread');
            } else {
                window.localStorage.setItem(storageKey(), new Date().toISOString());
                render();
                pulseStatus();
                decorateLinks();
                renderReadingProgress();
                showToast('✅ Page marked as read');
            }
        });

        render();
    });

    // keep nav/content link markers, the reading-progress indicator and the notes total in sync
    // if another tab on this site marks a page read/unread or adds a note
    window.addEventListener('storage', function (event) {
        if (!event.key) {
            return;
        }

        if (0 === event.key.indexOf(STORAGE_PREFIX)) {
            decorateLinks();
            renderReadingProgress();
        } else if (0 === event.key.indexOf(NOTES_PREFIX)) {
            decorateLinks();
            renderNotesTotal();
        }
    });
})();
