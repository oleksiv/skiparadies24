import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';
import * as fs from "fs";

(async () => {
    const browser = await puppeteer.launch({headless: false}); // 'new' is not a valid value, use false for non-headless mode
    const page = await browser.newPage();
    await page.setViewport({width: 1200, height: 1024});

    await page.goto('https://www.sport-hopfmann.de/marken/');
    await page.waitForSelector('.brands');

    // Extract product links from the page
    const content = await page.content();
    const $ = cheerio.load(content);

    const manufacturers: { name: string, image: string }[] = [];
    $('.brands a').each((index, element) => {
        const name = $(element).attr('title')!.replace('Artikel', '').trim() as string;
        const image = $(element).find('img').attr('src') as string;
        manufacturers.push({
            name,
            image,
        });
    });

    fs.writeFileSync(`manufacturers.json`, JSON.stringify(manufacturers, null, 4));

    await browser.close();
})();

