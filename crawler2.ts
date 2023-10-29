import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';
import * as fs from "fs";

(async () => {
    const browser = await puppeteer.launch({headless: false}); // 'new' is not a valid value, use false for non-headless mode
    const page = await browser.newPage();
    await page.setViewport({width: 1200, height: 1024});

    await page.goto('https://www.sport-hopfmann.de/wintersport-sport/alpin-ski/?filter=f5:o100.00-99999');
    await page.waitForSelector('#productList');

    // Extract product links from the page
    const content = await page.content();
    const $ = cheerio.load(content);

    const products: { name: string, href: string }[] = [];
    $('.list-container .productBox').each((index, element) => {
        const name = $(element).find('.productsTitle .hidden-xs.hidden-sm').text().trim();
        const href = $(element).find('.productBox a').attr('href');
        if (name && href) {
            products.push({
                name,
                href,
            });
        }
    });

    const scrapedData: any[] = [];
    // Visit each product page and get its HTML
    for (const product of products) {
        const {href} = product;
        await page.goto(product.href);
        await page.waitForSelector('#productinfo');

        const productPageContent = await page.content();

        const $ = cheerio.load(productPageContent);

        // get the current html
        getProductInfo($, href);

        // select only clickable buttons
        const otherColors: string[] = [];
        $('.colorContainer li:not(.active) a').each((index, element) => {
            const href = $(element).attr('href') as string;
            otherColors.push(href);
        });

        for (const color of otherColors) {
            await page.goto(color);
            await page.waitForSelector('#productTitle');

            getProductInfo($, href);
        }
    }


    await browser.close();
})();

function getProductInfo($: CheerioAPI, href: string) {
    const manufacturer = $('.productManufacturer').text().trim();
    const title = $('#productTitle').text().trim().replace(manufacturer, '').trim();

    const price = $('#productPrice').text().trim();
    const color = $('.itemColor').text().trim().replace('Farbe:', '').trim();

    const sizes: any[] = [];
    $('.sizeBlock .size').each((index, element) => {
        const size = $(element).attr('data-size');
        const ean = $(element).find('a').attr('data-ean');
        const price = $(element).find('a').attr('data-price');
        const uvp = $(element).find('a').attr('data-uvp');
        const sku = $(element).find('a').attr('data-sku')?.replace('Artikelnummer:', '').trim();
        const stock0 = $(element).find('a').attr('data-stock000');
        const stock1 = $(element).find('a').attr('data-stock001');

        sizes.push({
            ean,
            price,
            uvp,
            sku,
            stock0,
            stock1,
            size,
        });
    });

    const categories: any[] = [];
    $('.breadcrumb li').each((index, element) => {
        const cat = $(element).find('a').attr('title');
        if (cat) {
            categories.push(cat);
        }
    });


    const images: string[] = [];
    const firstImage = $('.picterContent .picture link').attr('href');
    if (firstImage) {
        images.push(firstImage);
    }
    $('.morePicsContainer .owl-stage .owl-item').each((index, element) => {
        const src = $(element).find('a').attr('href') as string;
        // Check if src is not empty and push to the array, otherwise use data-lazy
        if (!images.includes(src)) {
            images.push(src);
        }
    });

    const tabs: string[] = [];
    $('#contentamount .tabContent').each((index, element) => {
        const content = $(element).html() as string;
        tabs.push(content)
    })



    const res = {
        manufacturer,
        title,
        href,
        price,
        sizes,
        color,
        categories,
        images,
        tabs
    };


    console.log(title);
    const file = fs.readFileSync('data/result.json').toString();
    const added = [...JSON.parse(file), res];

    fs.writeFileSync(`data/result.json`, JSON.stringify(added, null, 4));

    return res;
}