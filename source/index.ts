#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import program from 'commander'
import puppeteer from 'puppeteer';
import fs from 'fs';
import request from 'request';
import * as settings from "./settings.json";
const domQueries = settings.queries;

async function doStuff(parameters: { showBrowser: boolean, outputFolder: string, performDownload: boolean }) {
  const browser = await puppeteer.launch({ headless: !parameters.showBrowser });
  const page = await browser.newPage();
  await page.goto(settings.carTalkPage, { waitUntil: 'networkidle2' });

  console.log("Start");

  await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });

  let buttonHandle = await page.$(domQueries.loadMoreButtons);

  let isNotHidden = await page.$eval(domQueries.loadMoreButtons, (elem) => {
    return window.getComputedStyle(elem).getPropertyValue('display') !== 'none';
  });


  let previousDownloadButtonCount = 0;
  let currentDownloadButtonCount = 0;
  let currentLoadMoreTryCount = 0;

  while (buttonHandle !== null && isNotHidden) {
    previousDownloadButtonCount = currentDownloadButtonCount;

    // Sometimes the page tweaks out if you click "Load More" too fast. This mitigates that issue.
    await sleep(settings.loadMoreDelay_ms).then(() => {
      buttonHandle!.click();
      console.log("Trying to load more...");
    });

    currentDownloadButtonCount = (await page.$$(domQueries.downloadButtons)).length;


    console.log(`Found ${currentDownloadButtonCount} download buttons so far.`)

    isNotHidden = await page.$eval(domQueries.loadMoreButtons, (elem) => {
      return window.getComputedStyle(elem).getPropertyValue('display') !== 'none';
    });

    // Seems to help with page reloading issues
    await page.waitFor(100);

    buttonHandle = await page.$(domQueries.loadMoreButtons);

    if (currentDownloadButtonCount == previousDownloadButtonCount) {
      currentLoadMoreTryCount += 1;
    }
    else {
      currentLoadMoreTryCount = 0;
    }

    if(currentLoadMoreTryCount > 5) {
      console.log(`No more buttons have been loaded after ${currentLoadMoreTryCount} attempts. Starting download process.`)
      break;
    }
  }

  console.log("Page fully expanded");

  const rawButtonLinks = await page.$$eval(domQueries.downloadButtons, el => el.map(x => x.getAttribute("href")));

  if (rawButtonLinks == null) {
    return;
  }

  const totalDownloadButtons = rawButtonLinks.length;
  console.log(`Found ${totalDownloadButtons} download buttons.`)

  const buttonLinks = rawButtonLinks.filter(notNullOrUndefined);

  const folderPath = parameters.outputFolder;

  const existingFiles = getExistingFiles(folderPath);  

  let currentDownloadCount = 1;
  for (let link of buttonLinks) {
    const fileName = getFileName(link);

    console.log(`Downloading '${fileName}' (${currentDownloadCount}/${totalDownloadButtons})`);

    currentDownloadCount++;
    if (existingFiles.has(fileName)) {
      console.log(`File ${fileName} already exists.`);
      continue;
    }

    await downloadAudioFromLinkAsync(link, fileName, folderPath);
  }

  console.log(`Downloaded ${buttonLinks.length} files to '${parameters.outputFolder}'`);

  await page.close();
}

function notNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Make sure to include trailing slash
async function downloadAudioFromLinkAsync(link: string, fileName: string, folderPath: string) {
  const fullFilePath = folderPath + "/" + fileName;
  const filePipe = fs.createWriteStream(fullFilePath);

  await new Promise((resolve, reject) => {
    let stream = request(link)
      .pipe(filePipe)
      .on('finish', () => {
        console.log(`The file is finished downloading.`);
        resolve();
      })
      .on('error', (error) => {
        reject(error);
      });
  })
    .catch(error => {
      console.log(`:( error: ${error}`);
      return;
    });
}

function getExistingFiles(filePath: string) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }

  return new Set(fs.readdirSync(filePath));
}

function getFileName(rawLink: string) {
  const indexOfMp3 = rawLink.indexOf(".mp3");
  const partialSubstring = rawLink.substring(0, indexOfMp3);
  const lastIndexOfSlash = partialSubstring.lastIndexOf("/");
  const fileName = partialSubstring.substring(lastIndexOfSlash + 1) + ".mp3";
  return fileName;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log(
  chalk.blueBright(
    figlet.textSync('Car Talk Downloader', { horizontalLayout: 'full' })
  )
);

function getAppDataPath() {
  return process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
}

const defaultPath = getAppDataPath() + "\\cartalkad";

program
  .name("cartalkad")
  .version('0.0.1')
  .description('Download publicly available Car Talk episodes via a CLI!')
  .option('--show-browser', 'Displays the web browser instance as the downloader is running.', false)
  .option('--force-run-all', 'Compiles the list of Car Talk episodes, and downloads them.', false)
  .option('-f, --output-folder <path>', 'Compiles the list of Car Talk episodes, and downloads them.', defaultPath)
  .option('-d, --dry-run', 'Eventually, this will search the Car Talk website and display what the output may represent. Will not download.', false)
  .option('-e, --download-new-episodes', 'Setting this causes episodes to be downloaded. Eventually will not download if filename already exists in output directory.')
  .parse(process.argv);

const outFolder = program.outputFolder;

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
else if (program.dryRun) {
  console.log(`Output Folder: '${outFolder}'`)
}
else if (program.runAll) {
  doStuff({
    outputFolder: outFolder,
    showBrowser: program.showBrowser,
    performDownload: true
  });
}
else {
  doStuff({
    outputFolder: outFolder,
    showBrowser: program.showBrowser,
    performDownload: program.downloadNewEpisodes
  });
}