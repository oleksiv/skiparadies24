import * as cheerio from 'cheerio';
import {CheerioAPI} from 'cheerio';
import {promises as fsPromises} from "fs";
import puppeteer from 'puppeteer';

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

// Main IIFE (Immediately Invoked Function Expression) to control the scraping process
(async () => {
    // Launch a browser instance
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.setViewport({width: 1200, height: 1024});

    // Iterate over the categories to scrape the data
    for (const category of CATEGORIES) {
        const filePath = `data/${category}.json`;

        // Skip if the file already exists
        if (await doesFileExist(filePath)) {
            console.log(`${filePath} - already exists`);
            continue;
        }

        // Navigate to the category page
        await page.goto(`https://www.sport-hopfmann.de/wintersport-sport/${category}/?listorderby=oxvarminprice&listorder=desc`);
        await page.waitForSelector('#productList');

        // Retrieve and load the HTML content of the category page
        const categoryPageHtml = await page.content();
        const $categoryPage = cheerio.load(categoryPageHtml);

        // Extract product summaries (name and URL)
        const productSummaries = extractProductSummaries($categoryPage);

        // Array to hold detailed data of all products
        const detailedProductData = [];

        // Loop through each product to extract detailed information
        for (const product of productSummaries) {
            await page.goto(product.url);
            await page.waitForSelector('#productinfo');
            const productDetailPageHtml = await page.content();
            const $productDetailPage = cheerio.load(productDetailPageHtml);

            // Extract and log the main product variant details
            const mainProductDetails = extractProductDetails($productDetailPage, product.url);
            detailedProductData.push([mainProductDetails]);
            console.log(`${mainProductDetails.productName} - Processed`);

            // Handle additional product variants (e.g., different colors)
            await handleAdditionalVariants(page, $productDetailPage, detailedProductData);
        }

        // Write the detailed product data to a file in a formatted way
        await fsPromises.writeFile(filePath, JSON.stringify(detailedProductData, null, 4));
        console.log(`Scraping complete for category: ${category}`);
    }

    // Close the browser after scraping
    await browser.close();
})();

// Function to check if the given file exists using async/await
async function doesFileExist(filePath) {
    try {
        await fsPromises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Function to extract product summaries from the category page HTML
function extractProductSummaries($) {
    const productSummaries = [];
    $('.list-container .productBox').each((index, element) => {
        const name = $(element).find('.productsTitle .hidden-xs.hidden-sm').text().trim();
        const url = $(element).find('.productBox a').attr('href');
        if (name && url) {
            productSummaries.push({name, url});
        }
    });
    return productSummaries;
}

// Function to handle additional product variants (e.g., different colors)
async function handleAdditionalVariants(page, $, detailedProductData) {
    const colorVariantLinks = [];
    $('.colorContainer li:not(.active) a').each((index, element) => {
        const variantUrl = $(element).attr('href');
        if (variantUrl) {
            colorVariantLinks.push(variantUrl);
        }
    });

    for (const variantUrl of colorVariantLinks) {
        await page.goto(variantUrl);
        await page.waitForSelector('#productTitle');
        const variantPageHtml = await page.content();
        const $variantPage = cheerio.load(variantPageHtml);
        const variantDetails = extractProductDetails($variantPage, variantUrl);
        detailedProductData.push(variantDetails);
        console.log(`${variantDetails.productName} - Processed`);
    }
}

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
