import puppeteer from 'puppeteer';
import fs from 'fs';
import request from 'request';

const carTalkPage = "https://www.npr.org/podcasts/510208/car-talk";

async function doStuff() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(carTalkPage, { waitUntil: 'networkidle2' });

  await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' })

  let buttonHandle = await page.$(".options__load-more");

  let isNotHidden = await page.$eval('.options__load-more', (elem) => {
    return window.getComputedStyle(elem).getPropertyValue('display') !== 'none';
  });

  // while (buttonHandle !== null && isNotHidden) {

  //   await sleep(600).then(() => {
  //     buttonHandle!.click();
  //     console.log("Clicked");
  //   });

  //   buttonHandle = await page.$(".options__load-more");
  //   isNotHidden = await page.$eval('.options__load-more', (elem) => {
  //     return window.getComputedStyle(elem).getPropertyValue('display') !== 'none';
  //   });
  // }

  const buttonQuery = ".audio-tool.audio-tool-download > a";
  const buttonLinks = await page.$$eval(buttonQuery, el => el.map(x => x.getAttribute("href")));

  for(let link of buttonLinks) {
    const notNullLink = link!;
    const fileName = getFileName(notNullLink);
    const folderPath = "E:/CarTalks/";
    console.log(fileName);  

    //downloadAudioFromLink(notNullLink, fileName, folderPath);
    await downloadAudioFromLinkAsync(notNullLink, fileName, folderPath);
  }

  console.log(buttonLinks.length);
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
  const lastIndexofSlash = partialSubstring.lastIndexOf("/");
  const fileName = partialSubstring.substring(lastIndexofSlash + 1) + ".mp3";
  return fileName;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

doStuff();