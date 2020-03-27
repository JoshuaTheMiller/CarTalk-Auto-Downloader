#!/usr/bin/env node

import chalk from 'chalk';
import figlet from 'figlet';
import program from 'commander'
import puppeteer from 'puppeteer';
import fs from 'fs';
import request from 'request';

const carTalkPage = "https://www.npr.org/podcasts/510208/car-talk";
// Sometimes the page tweaks out if you click "Load More" too fast. This mitigates that issue.
const magicPageSleepTimer = 700;

async function doStuff(parameters: { showBrowser: boolean, outputFolder: string }) {
  const browser = await puppeteer.launch({ headless: !parameters.showBrowser });
  const page = await browser.newPage();
  await page.goto(carTalkPage, { waitUntil: 'networkidle2' });

  await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' })

  let buttonHandle = await page.$(".options__load-more");

  let isNotHidden = await page.$eval('.options__load-more', (elem) => {
    return window.getComputedStyle(elem).getPropertyValue('display') !== 'none';
  });

  while (buttonHandle !== null && isNotHidden) {

    await sleep(magicPageSleepTimer).then(() => {
      buttonHandle!.click();
      console.log("Clicked");
    });

    buttonHandle = await page.$(".options__load-more");
    isNotHidden = await page.$eval('.options__load-more', (elem) => {
      return window.getComputedStyle(elem).getPropertyValue('display') !== 'none';
    });
  }

  const buttonQuery = ".audio-tool.audio-tool-download > a";
  const rawButtonLinks = await page.$$eval(buttonQuery, el => el.map(x => x.getAttribute("href")));

  if (rawButtonLinks == null) {
    return;
  }

  const buttonLinks = rawButtonLinks.filter(notNullOrUndefined);

  for (let link of buttonLinks) {
    const fileName = getFileName(link);
    const folderPath = parameters.outputFolder;

    console.log(fileName);

    await downloadAudioFromLinkAsync(link, fileName, folderPath);
  }

  console.log(buttonLinks.length);
}

function notNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Make sure to include trailing slash
async function downloadAudioFromLinkAsync(link: string, fileName: string, folderPath: string) {
  const filePipe = fs.createWriteStream(folderPath + fileName);

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
    });
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
    figlet.textSync('Car Talk Episode Scraper', { horizontalLayout: 'full' })
  )
);

function getAppDataPath() {
  return process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
}

const defaultPath = getAppDataPath() + "\\cartalk-scraper"

program
  .name("cartalk-scraper")
  .version('0.0.1')
  .description('Download publicly available Car Talk episodes via a CLI!')
  .option('--show-browser', 'Displays the web browser instance as the scraper is running.', false)
  .option('--force-run-all', 'Compiles the list of Car Talk episodes, and downloads them.', false)
  .option('-f, --output-folder <path>', 'Compiles the list of Car Talk episodes, and downloads them.', defaultPath)
  .option('-d, --dry-run', 'Eventually, this will scrape the Car Talk website and display what the output may represent. Will not download.', false)
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

const outFolder = program.outputFolder;

if(program.dryRun) {
  console.log(`Output Folder: '${outFolder}'`)
}
else if (program.runAll) {
  doStuff({
    outputFolder: outFolder,
    showBrowser: program.showBrowser
  });
}