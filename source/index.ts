import puppeteer from 'puppeteer';
import fs from 'fs';
import request from 'request';
import { URL } from 'url';

const carTalkPage = "https://www.npr.org/podcasts/510208/car-talk";

async function doStuff() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(carTalkPage, { waitUntil: 'networkidle2' });

  await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' })

  const buttonQuery = ".audio-tool.audio-tool-download > a";
  const buttonLinks = await page.$$eval(buttonQuery, el => el.map(x => x.getAttribute("href")));

  buttonLinks.forEach(link => {
    const notNullLink = link!;
    const fileName = getFileName(notNullLink);
    const folderPath = "E:/CarTalks/";
    console.log(fileName);
    downloadAudioFromLink(notNullLink, fileName, folderPath);
  });

  console.log(buttonLinks.length);
}

// Make sure to include trailing slash
function downloadAudioFromLink(link: string, fileName: string, folderPath: string) {
  request.get(link)
    .pipe(fs.createWriteStream(folderPath + fileName));
}

function getFileName(rawLink: string) {
  const indexOfMp3 = rawLink.indexOf(".mp3");
  const partialSubstring = rawLink.substring(0, indexOfMp3);
  const lastIndexofSlash = partialSubstring.lastIndexOf("/");
  const fileName = partialSubstring.substring(lastIndexofSlash + 1) + ".mp3";
  return fileName;
}

doStuff();