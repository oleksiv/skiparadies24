import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';
import * as fs from "fs";

const URLS = [
    'crosstrainer',
    'laufband',
    'rudergeraet',
    'liegeergometer',
    'heimtrainer',
    'ergometer',
    'kraftstation',
    'kabelzugstation',
    'hantelbank',
    'langhantelstation',
];

const BASE_URL = `https://www.sport-tiedje.de`;

(async () => {
    const browserInstance = await puppeteer.launch({headless: false});
    const browserPage = await browserInstance.newPage();
    await browserPage.setViewport({width: 1200, height: 1024});

    for (let category of URLS) {
        const fileExists = fs.existsSync(`sport-tiedje/data/${category}.json`)
        if (fileExists) {
            console.log(`sport-tiedje/data/${category}.json - already exist`)
            continue;
        }

        await browserPage.goto(`${BASE_URL}/${category}`);
        await browserPage.waitForSelector('.list-products');

        const pageHtml = await browserPage.content();
        const loadedHtml = cheerio.load(pageHtml);

        const products: any[] = [];
        loadedHtml('.list-products .list-product-list').each((index, element) => {
            const productName = loadedHtml(element).find('.product-name a').text().trim();
            const productUrl = loadedHtml(element).find('.product-name a').attr('href');
            products.push({
                name: productName,
                url: productUrl,
            });
        });

        console.log(products);

        const detailedProductData: any[][] = [];
        for (const product of products) {
            await browserPage.goto(`${BASE_URL}${product.url}`);
            console.log(`${category} | ${product.name}`);

            const detailedPageHtml = await browserPage.content();
            const detailedHtml = cheerio.load(detailedPageHtml);

            const data: any = extractProductDetails(detailedHtml, product.url);
            detailedProductData.push(data);
        }

        console.log('Scraping complete.');

        fs.writeFileSync(`sport-tiedje/data/${category}.json`, JSON.stringify(detailedProductData, null, 4));
    }


    await browserInstance.close();
})();

function extractProductDetails(loadedHtml: CheerioAPI, productUrl: string) {
    const title = loadedHtml('h1').text().trim();

    const images: any[] = [];
    loadedHtml('.carousel-inner .carousel-item a').each((index, element) => {
        images.push({
            src:  loadedHtml(element).attr('href'),
        })
    })

    return {
        title,
        images
    };
}
