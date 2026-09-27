(function () {
    'use strict';

    var STORAGE_KEY = 'symfony-docs-theme';

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(theme, button) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        if (button) {
            button.innerHTML = theme === 'dark' ? '☀️' : '🌙';
            button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
            button.title = button.getAttribute('aria-label');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var button = document.getElementById('theme-toggle-button');
        if (!button) {
            button = document.createElement('button');
            button.id = 'theme-toggle-button';
            button.type = 'button';
            button.className = 'theme-toggle-btn';
            document.body.appendChild(button);
        }

        applyTheme(currentTheme(), button);

        button.addEventListener('click', function () {
            var nextTheme = currentTheme() === 'dark' ? 'light' : 'dark';
            window.localStorage.setItem(STORAGE_KEY, nextTheme);
            applyTheme(nextTheme, button);
        });
    });
})();
