#!/usr/bin/env php
<?php
require __DIR__.'/vendor/autoload.php';

use Symfony\Component\Console\Application;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Style\SymfonyStyle;
use SymfonyDocsBuilder\BuildConfig;
use SymfonyDocsBuilder\DocBuilder;

(new Application('Symfony Docs Builder', '1.0'))
    ->register('build-docs')
    ->addOption('generate-fjson-files', null, InputOption::VALUE_NONE, 'Use this option to generate docs both in HTML and JSON formats')
    ->addOption('disable-cache', null, InputOption::VALUE_NONE, 'Use this option to force a full regeneration of all doc contents')
    ->setCode(function(InputInterface $input, OutputInterface $output) {
        // the doc building app doesn't work on Windows
        if ('\\' === DIRECTORY_SEPARATOR) {
            $output->writeln('<error>ERROR: The application that builds Symfony Docs does not support Windows. You can try using a Linux distribution via WSL (Windows Subsystem for Linux).</error>');

            return 1;
        }

        $io = new SymfonyStyle($input, $output);
        $io->text('Building all Symfony Docs...');

        $outputDir = __DIR__.'/output';
        $buildConfig = (new BuildConfig())
            ->setSymfonyVersion('7.1')
            ->setContentDir(__DIR__.'/..')
            ->setOutputDir($outputDir)
            ->setImagesDir(__DIR__.'/output/_images')
            ->setImagesPublicPrefix('_images')
            ->setTheme('rtd')
        ;

        $buildConfig->setExcludedPaths(['.github/', '_build/']);

        if (!$generateJsonFiles = $input->getOption('generate-fjson-files')) {
            $buildConfig->disableJsonFileGeneration();
        }

        if ($isCacheDisabled = $input->getOption('disable-cache')) {
            $buildConfig->disableBuildCache();
        }

        $io->comment(sprintf('cache: %s / output file type(s): %s', $isCacheDisabled ? 'disabled' : 'enabled', $generateJsonFiles ? 'HTML and JSON' : 'HTML'));
        if (!$isCacheDisabled) {
            $io->comment('Tip: add the --disable-cache option to this command to force the re-build of all docs.');
        }

        $result = (new DocBuilder())->build($buildConfig);

        if ($result->isSuccessful()) {
            // current branch name (e.g. "8.0"), shown next to each page's own title
            $branchName = trim((string) shell_exec('git -C '.escapeshellarg(__DIR__.'/..').' rev-parse --abbrev-ref HEAD 2>/dev/null'));

            // use the "Monokai Sublime" theme for code blocks instead of the default one
            $highlightCssOutputPath = $outputDir.'/assets/css/highlightjs.css';
            if (is_file($highlightCssOutputPath)) {
                copy(__DIR__.'/vendor/scrivo/highlight.php/styles/monokai-sublime.css', $highlightCssOutputPath);
            }

            // copy the light/dark theme toggle script and its stylesheet into the build output
            $themeToggleJsRelativePath = 'assets/js/theme-toggle.js';
            $themeToggleJsOutputPath = $outputDir.'/'.$themeToggleJsRelativePath;
            if (!is_dir(dirname($themeToggleJsOutputPath))) {
                mkdir(dirname($themeToggleJsOutputPath), 0777, true);
            }
            copy(__DIR__.'/theme-toggle.js', $themeToggleJsOutputPath);

            $darkModeCssRelativePath = 'assets/css/dark-mode.css';
            $darkModeCssOutputPath = $outputDir.'/'.$darkModeCssRelativePath;
            if (!is_dir(dirname($darkModeCssOutputPath))) {
                mkdir(dirname($darkModeCssOutputPath), 0777, true);
            }
            copy(__DIR__.'/dark-mode.css', $darkModeCssOutputPath);

            // copy the "mark as read" script into the build output
            $lastReadJsRelativePath = 'assets/js/last-read.js';
            $lastReadJsOutputPath = $outputDir.'/'.$lastReadJsRelativePath;
            if (!is_dir(dirname($lastReadJsOutputPath))) {
                mkdir(dirname($lastReadJsOutputPath), 0777, true);
            }
            copy(__DIR__.'/last-read.js', $lastReadJsOutputPath);

            // total number of generated pages, shown by the reading-progress indicator on the home page
            $totalPages = iterator_count(new RegexIterator(
                new RecursiveIteratorIterator(new RecursiveDirectoryIterator($outputDir)),
                '/^.+\.html$/i',
                RegexIterator::MATCH
            ));

            // fix assets URLs to make them absolute (otherwise, they don't work in subdirectories)
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($outputDir));

            foreach (new RegexIterator($iterator, '/^.+\.html$/i', RegexIterator::GET_MATCH) as $match) {
                $htmlFilePath = array_shift($match);
                $htmlContents = file_get_contents($htmlFilePath);

                $htmlRelativeFilePath = str_replace($outputDir.'/', '', $htmlFilePath);
                $subdirLevel = substr_count($htmlRelativeFilePath, '/');
                $baseHref = str_repeat('../', $subdirLevel);

                // make relative asset URLs work from any subdirectory. Deliberately NOT using a <base> tag for
                // this: a <base> with a non-empty path silently breaks every plain "#anchor" link on the page
                // (e.g. every heading's permalink icon), since those then resolve against the base's directory
                // instead of the current page - sending the browser to a different page entirely.
                $htmlContents = str_replace('href="assets/', 'href="'.$baseHref.'assets/', $htmlContents);
                $htmlContents = str_replace('src="assets/', 'src="'.$baseHref.'assets/', $htmlContents);
                $htmlContents = str_replace('<img src="/_images/', '<img src="'.$baseHref.'_images/', $htmlContents);

                // dark mode: apply the saved/preferred theme before first paint, and load its stylesheet
                if (false === strpos($htmlContents, $darkModeCssRelativePath)) {
                    $noFlashScript = '<script type="text/javascript">(function(){try{var t=localStorage.getItem(\'symfony-docs-theme\');'
                        .'if(t===\'dark\'||(!t&&window.matchMedia&&window.matchMedia(\'(prefers-color-scheme: dark)\').matches)){'
                        .'document.documentElement.setAttribute(\'data-theme\',\'dark\');}}catch(e){}})();</script>'."\n"
                        .'    <link rel="stylesheet" href="'.$baseHref.$darkModeCssRelativePath.'" type="text/css">';
                    $htmlContents = str_replace('<head>', '<head>'."\n".'    '.$noFlashScript, $htmlContents);
                }

                // append the branch name after each page's own title, e.g. "Symfony Documentation (8.0)"
                if ('' !== $branchName) {
                    $branchSuffix = ' ('.$branchName.')';
                    $htmlContents = preg_replace_callback(
                        '/(<h1 id="[^"]*">\s*)((?:(?!<a class="headerlink").)*?)(\s*<a class="headerlink")/s',
                        function (array $m) use ($branchSuffix): string {
                            $title = rtrim($m[2]);
                            // skip if the suffix is already there (avoids stacking on repeated builds)
                            if ($branchSuffix === substr($title, -\strlen($branchSuffix))) {
                                return $m[0];
                            }

                            return $m[1].$title.$branchSuffix.$m[3];
                        },
                        $htmlContents,
                        1
                    );
                }

                // reading-progress indicator, home page only, placed right before the "Quick Tour" section
                if ('index.html' === $htmlRelativeFilePath && false === strpos($htmlContents, 'id="reading-progress"')) {
                    $progressHtml = '<div id="reading-progress" class="reading-progress" data-total="'.$totalPages.'">'
                        .'<span id="reading-progress-text">0/'.$totalPages.' read</span>'
                        .'<div class="reading-progress-bar"><div id="reading-progress-bar-fill" class="reading-progress-bar-fill" style="width:0%"></div></div>'
                        .'<span id="reading-progress-percent">0%</span>'
                        .'</div>';
                    $htmlContents = str_replace('</h1>', '</h1>'."\n".$progressHtml, $htmlContents);
                }

                // load the "mark as read" button/script on every page (skip if already injected)
                if (false === strpos($htmlContents, $lastReadJsRelativePath)) {
                    $htmlContents = str_replace(
                        '</body>',
                        '    <script type="text/javascript" src="'.$baseHref.$lastReadJsRelativePath.'"></script>'."\n".'</body>',
                        $htmlContents
                    );
                }

                // load the light/dark theme toggle button/script on every page (skip if already injected)
                if (false === strpos($htmlContents, $themeToggleJsRelativePath)) {
                    $htmlContents = str_replace(
                        '</body>',
                        '    <script type="text/javascript" src="'.$baseHref.$themeToggleJsRelativePath.'"></script>'."\n".'</body>',
                        $htmlContents
                    );
                }

                file_put_contents($htmlFilePath, $htmlContents);
            }

            foreach (new RegexIterator($iterator, '/^.+\.css/i', RegexIterator::GET_MATCH) as $match) {
                $htmlFilePath = array_shift($match);
                $htmlContents = file_get_contents($htmlFilePath);
                file_put_contents($htmlFilePath, str_replace('fonts/', '../fonts/', $htmlContents));
            }

            $io->success(sprintf("The Symfony Docs were successfully built at %s", realpath($outputDir)));
        } else {
            $io->error(sprintf("There were some errors while building the docs:\n\n%s\n", $result->getErrorTrace()));
            $io->newLine();
            $io->comment('Tip: you can add the -v, -vv or -vvv flags to this command to get debug information.');

            return 1;
        }

        return 0;
    })
    ->getApplication()
    ->setDefaultCommand('build-docs', true)
    ->run();
