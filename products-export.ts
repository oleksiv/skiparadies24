import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';
import * as fs from "fs";

const CATEGORIES = [
    'alpin-ski',
    'eishockeyschlaeger',
    'langlaufschuhe',
    'langlaufski-und-schneeschuhe',
    'langlaufstoecke-skistoecke',
    'protektoren',
    'schlitten-rutscher',
    'schlittschuhe',
    'skibrillen',
    'skihelme',
    'skischuhe',
    'snowboardbindungen',
    'snowboardboots',
    'snowboards',
    'zubehoer-wachs-bindungen',
];
(async () => {
    const browserInstance = await puppeteer.launch({headless: false});
    const browserPage = await browserInstance.newPage();
    await browserPage.setViewport({width: 1200, height: 1024});

    for (let category of CATEGORIES) {
        const fileExists = fs.existsSync(`data/${category}.json`)
        if (fileExists) {
            console.log(`data/${category}.json - already exist`)
            continue;
        }

        await browserPage.goto(`https://www.sport-hopfmann.de/wintersport-sport/${category}/?cl=alist&searchparam=&cnid=292&ldtype=grid&_artperpage=60&listorderby=oxvarminprice&listorder=desc&pgNr=0`);
        await browserPage.waitForSelector('#productList');

        const pageHtml = await browserPage.content();
        const loadedHtml = cheerio.load(pageHtml);

        const skiProducts: { name: string, url: string }[] = [];
        loadedHtml('.list-container .productBox').each((index, element) => {
            const productName = loadedHtml(element).find('.productsTitle .hidden-xs.hidden-sm').text().trim();
            const productUrl = loadedHtml(element).find('.productBox a').attr('href');
            if (productName && productUrl) {
                skiProducts.push({
                    name: productName,
                    url: productUrl,
                });
            }
        });


        const detailedProductData: { productColors: any[] }[] = [];
        for (const product of skiProducts) {
            await browserPage.goto(product.url);
            await browserPage.waitForSelector('#productinfo');

            const detailedPageHtml = await browserPage.content();
            const detailedHtml = cheerio.load(detailedPageHtml);


            const colorProductDetails = [];

            const productDetails = extractProductDetails(detailedHtml, product.url);
            colorProductDetails.push(productDetails);
            console.log(`${productDetails.productName} - Done`);

            const colorLinks: string[] = [];
            detailedHtml('.colorContainer li:not(.active) a').each((index, element) => {
                const colorLink = detailedHtml(element).attr('href') as string;
                colorLinks.push(colorLink);
            });

            for (let colorLink of colorLinks) {
                await browserPage.goto(colorLink);
                await browserPage.waitForSelector('#productTitle');
                const newDetailedPageHtml = await browserPage.content();
                const newDetailedHtml = cheerio.load(newDetailedPageHtml);
                const productDetails = extractProductDetails(newDetailedHtml, colorLink);
                colorProductDetails.push(productDetails);
                console.log(`${productDetails.productName} - Done`);
            }


            detailedProductData.push({productColors: colorProductDetails});
        }

        console.log('Scraping complete.');

        fs.writeFileSync(`data/${category}.json`, JSON.stringify(detailedProductData, null, 4));
    }


    await browserInstance.close();
})();

function extractProductDetails(loadedHtml: CheerioAPI, productUrl: string) {
    const brand = loadedHtml('.productManufacturer').text().trim();
    const productName = loadedHtml('#productTitle').text().trim().replace(brand, '').trim();
    const productPrice = loadedHtml('#productPrice').text().trim();
    const chosenColor = loadedHtml('.itemColor').text().trim().replace('Farbe:', '').trim();

    const availableSizes: any[] = [];
    loadedHtml('.sizeBlock .size').each((index, element) => {
        const sizeValue = loadedHtml(element).attr('data-size');
        const productEAN = loadedHtml(element).find('a').attr('data-ean');
        const sizePrice = loadedHtml(element).find('a').attr('data-price');
        const recommendedPrice = loadedHtml(element).find('a').attr('data-uvp');
        const skuValue = loadedHtml(element).find('a').attr('data-sku')?.replace('Artikelnummer:', '').trim();
        const stockMain = loadedHtml(element).find('a').attr('data-stock000');
        const stockAdditional = loadedHtml(element).find('a').attr('data-stock001');

        availableSizes.push({
            productEAN,
            sizePrice,
            recommendedPrice,
            skuValue,
            stockMain,
            stockAdditional,
            sizeValue,
        });
    });

    const productCategories: any[] = [];
    loadedHtml('.breadcrumb li').each((index, element) => {
        const category = loadedHtml(element).find('a').attr('title');
        if (category) {
            productCategories.push(category);
        }
    });

    const productImages: any[] = [];
    const mainImage = loadedHtml('.picterContent .picture link').attr('href');
    if (mainImage) {
        productImages.push(mainImage);
    }
    loadedHtml('.morePicsContainer .owl-stage .owl-item').each((index, element) => {
        const imageSrc = loadedHtml(element).find('a').attr('href') as string;
        if (!productImages.includes(imageSrc)) {
            productImages.push(imageSrc);
        }
    });

    loadedHtml('#beschreibung h2').remove();
    loadedHtml('#beschreibung .itemCode').remove();

    const productDescription = loadedHtml('#beschreibung')!.html()!.trim();

    return {
        brand,
        productName,
        productUrl,
        productPrice,
        availableSizes,
        chosenColor,
        productCategories,
        productImages,
        productDescription
    };
}
