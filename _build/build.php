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
