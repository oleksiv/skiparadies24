import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';

(async () => {
    const browser = await puppeteer.launch({headless: false}); // 'new' is not a valid value, use false for non-headless mode
    const page = await browser.newPage();
    await page.setViewport({width: 1200, height: 1024});

    await page.goto('https://www.glisshop.de/ski/ski-latten/herren/?facetFilters%5Bf_482812%5D%5Bmin%5D=100&facetFilters%5Bf_482812%5D%5Bmax%5D=1100');
    await page.waitForSelector('.product-list');

    // Extract product links from the page
    const content = await page.content();
    const $ = cheerio.load(content);

    const products: { name: string, href: string }[] = [];
    $('.product-list-item').each((index, element) => {
        const name = $(element).find('.product-label_title').text().trim();
        const href = $(element).find('.product-label a').attr('href');
        if (name && href) {
            products.push({
                name,
                href,
            });
        }
    });


    // Visit each product page and get its HTML
    for (const product of products) {
        const {href} = product;
        console.log(`Visiting product: ${product.name}`);
        await page.goto(product.href);
        await page.waitForSelector('#cartBox .price-value'); // Assuming '.product-detail' is a selector on the product page

        const productPageContent = await page.content();

        const $ = cheerio.load(productPageContent);

        // get the current html
        getProductInfo($, href);

        // select only clickable buttons
        const buttons = $('ul.c-axes__list li');

        // If variants exist
        if (buttons.length) {
            for (let i = 0; i < buttons.length; i++) {

                // Click on the nth button using Puppeteer
                const selector = `ul.c-axes__list li:nth-child(${i + 1}) button.btn-default`;

                // Check if selector exists using Puppeteer
                const buttonElement = await page.$(selector);
                if (!buttonElement) {
                    // If the selector does not exist, continue to the next iteration
                    continue;
                }

                await page.click(selector);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // then get the updated product info
                const updatedContent = await page.content();
                const updated$ = cheerio.load(updatedContent);

                getProductInfo(updated$, href);
            }
        }


        console.log(`Visited and fetched content for product: ${product.name}`);
    }

    await browser.close();
})();

function getProductInfo($: CheerioAPI, href: string) {
    const rg_title_t23 = $('.rg-title_t23').text().trim();
    const rg_title_t32 = $('.rg-title_t32').text().trim();
    const price = $('#cartBox .price-value').text().trim();
    const variant = $('ul.c-axes__list li button.is-active').text().trim();
    const content = $('.c-informations-tabs__tabs-content-col-left .textual-content').html();

    const technicalData: any[] = [];
    $('.c-technical-data__wrapper li').each((index, element) => {
        technicalData.push({
            title: $(element).find('.c-informations-tabs__features-title').text().trim(),
            value: $(element).find('.c-informations-tabs__features-value').text().trim(),
        })
    });

    // breadcrumb
    const categories: any[] = [];
    $('.breadcrumb li').each((index, element) => {
        const cat = $(element).find('a span').text().trim();
        if (cat && cat !== 'Home') {
            categories.push(cat);
        }
    });

    const imageUrls: string[] = [];
    $('.swiper-wrapper img').each((index, img) => {
        const src = $(img).attr('src');
        const dataLazy = $(img).attr('data-lazy');

        // Check if src is not empty and push to the array, otherwise use data-lazy
        if (src && src.trim() !== '') {
            imageUrls.push(src);
        } else if (dataLazy && dataLazy.trim() !== '') {
            imageUrls.push(dataLazy);
        }
    });

    console.log({
        categories,
        href,
        rg_title_t23,
        rg_title_t32,
        price,
        variant,
        // content,
        technicalData,
        images: imageUrls  // Adding the extracted image URLs to the log
    });
}