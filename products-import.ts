import axios, {AxiosResponse} from 'axios';
import * as fs from "fs";
import {Product} from "./models";
import * as crypto from 'crypto';
import {uuid} from "uuidv4";

const BASE_URL = 'https://www.skiparadies24.de/api/';
const AUTH_HEADERS = {
    'Accept': `application/json`,
    'Content-Type': `application/json`
};

async function getAuthToken(): Promise<string> {
    console.log("Requesting authentication token...");
    const response: AxiosResponse<any, any> = await axios.post(`${BASE_URL}oauth/token`, {
        "client_id": "administration",
        "grant_type": "password",
        "scopes": "write",
        "username": "admin",
        "password": "HKL43lL\"!4!"
    });
    console.log("Authentication successful.");
    return response.data.access_token;
}


async function upsertMedia(alt: string, src: string, headers: any) {
    const mediaId = crypto.createHash('md5').update(src).digest('hex');
    try {
        return await axios.get(`https://www.skiparadies24.de/api/media/${mediaId}`, {headers});
    } catch (e) {
        const createdMedia = await axios.post('https://www.skiparadies24.de/api/media?_response=true',
            {
                id: mediaId,
                title: alt,
                mediaFolderId: '018b8174a3db7984bbbdc43198a5f83d'
            }, {headers}
        );

        await axios.post(`https://www.skiparadies24.de/api/_action/media/${createdMedia.data.data.id}/upload?extension=jpg&_response=true`,
            {
                url: src
            }, {headers}
        );

        return createdMedia;

    }
}

async function upsertProduct(product: Product, productId: string, configuratorSettings: any[], headers: any) {
    const productPrice = await parsePrice(product.availableSizes[0].sizePrice);

    try {
        const existingProduct = await axios.post(`https://www.skiparadies24.de/api/product/${productId}`);

        console.log(`Product already exist: ${product.productName}`);

        return existingProduct;
    } catch (e) {
        const hashedManufacturerId = crypto.createHash('md5').update(product.brand).digest('hex');

        const parentCreated = await axios.post('https://www.skiparadies24.de/api/product?_response=true',
            {
                "id": productId,
                "stock": 10,
                "productNumber": productId,
                "name": product.productName,
                "manufacturerId": hashedManufacturerId,
                "taxId": "018b669100c5705d99f62820ab0514c5", // standard rate
                "price": [
                    {
                        "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                        "gross": productPrice, // ?
                        "net": productPrice, // ?
                        "linked": false
                    }
                ],
                "variantListingConfig": {
                    "configuratorGroupConfig": [
                        {
                            "id": "269c7e40a54a462e884edb004c5f7bc8", // Color
                            "representation": "box",
                            "expressionForListings": true
                        },
                        {
                            "id": "75f353b589d04bf48e8a9ab1f5422b0e", // Size
                            "representation": "box",
                            "expressionForListings": false
                        }
                    ]
                },
                // All available options for this product
                "configuratorSettings": configuratorSettings
            }, {headers}
        );

        console.log(product.productImages);

        for (let i = 0; i < product.productImages.length; i++) {

            console.log(`Creating media for: ${product.productName}`);

            const imageSrc = product.productImages[i];

            const createdMedia = await upsertMedia(`${product.productName} ${i}`, imageSrc, headers);

            const productMedia = await axios.post(`https://www.skiparadies24.de/api/product-media?_response=true`,
                {
                    productId: parentCreated.data.data.id,
                    mediaId: createdMedia.data.data.id,
                }, {headers}
            );

            // Set cover image
            await axios.patch(`https://www.skiparadies24.de/api/product/${parentCreated.data.data.id}?_response=true`,
                {
                    coverId: productMedia.data.data.id,
                }, {headers}
            );
        }

        return parentCreated;
    }
}

async function upsertOptions(product: { productColors: Product[] }, headers: any) {
    console.log("Fetching group options...");
    const groupOptionsData = await axios.get('https://www.skiparadies24.de/api/property-group-option?limit=999', {headers});
    console.log("Fetched group options.");

    const fetchedOptions = groupOptionsData.data.data as any[];

    const options = [];
    for (let color of product.productColors) {

        let productColor = fetchedOptions.find(option => option.name === color.chosenColor && option.groupId === '269c7e40a54a462e884edb004c5f7bc8');

        if (!productColor) {
            const response = await axios.post('https://www.skiparadies24.de/api/property-group-option?_response=true', {
                "groupId": "269c7e40a54a462e884edb004c5f7bc8", // color
                "name": color.chosenColor
            }, {headers});
            productColor = response.data.data;
            console.log(`Created Color: ${productColor.name}`);
        } else {
            console.log(`Color already exists: ${productColor.name}`);
        }

        options.push(productColor);

        for (let size of color.availableSizes) {
            let productSize = fetchedOptions.find(option => option.name === size.sizeValue && option.groupId === '75f353b589d04bf48e8a9ab1f5422b0e');
            if (!productSize) {
                const response = await axios.post('https://www.skiparadies24.de/api/property-group-option?_response=true', {
                    "groupId": "75f353b589d04bf48e8a9ab1f5422b0e", // size
                    "name": size.sizeValue
                }, {headers});
                productSize = response.data.data;
                console.log(`Created Size: ${productSize.name}`);
            } else {
                console.log(`Size already exists: ${productSize.name}`);
            }

            options.push(productSize);
        }
    }

    return options;
}

async function createChild(parentId: string, productName: string, productEAN: string, productPrice: number, options: {
    id: string
}[], headers: any) {
    const sizeProductId = crypto.createHash('md5').update(productEAN).digest('hex');

    try {
        return await axios.get(`https://www.skiparadies24.de/api/product/${sizeProductId}`, {headers});
    } catch (e) {
        return await axios.post('https://www.skiparadies24.de/api/product?_response=true',
            {
                "id": sizeProductId,
                "parentId": parentId,
                "productNumber": uuid(),
                "name": productName,
                "ean": productEAN,
                "stock": 10,
                "price": [
                    {
                        "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                        "gross": productPrice, // ?
                        "net": productPrice, // ?
                        "linked": false
                    }
                ],
                "options": options
            }, {headers}
        );
    }

}

async function parsePrice(price: string) {
    // Extract the numeric portion and replace comma with a period
    const numericString = price.replace(/[^0-9,]/g, '').replace(',', '.');

    // Convert to number and multiply by 100
    return Math.round(parseFloat(numericString));
}

(async () => {
    const file = fs.readFileSync('data/alpin-ski.json').toString();
    const data: { productColors: Product[] }[] = JSON.parse(file);

    const authToken = await getAuthToken();
    const headers = {...AUTH_HEADERS, 'Authorization': `Bearer ${authToken}`};

    for (let product of data) {
        console.log(`Processing product: ${product.productColors[0].productName}`);
        const options = await upsertOptions(product, headers);

        try {
            const firstProductColor = product.productColors[0];
            const firstProductSize = firstProductColor.availableSizes[0];
            const productHash = crypto.createHash('md5').update(firstProductSize.productEAN).digest('hex');

            console.log(`Creating product: ${firstProductColor.productName}`);
            const parent = await upsertProduct(firstProductColor, productHash, options.map(o => ({optionId: o.id})), headers);

            for (let color of product.productColors) {
                const productColorOption = options.find(option => option.name === color.chosenColor);
                for (let size of color.availableSizes) {
                    const productSizeOption = options.find(option => option.name === size.sizeValue);
                    const price = await parsePrice(size.sizePrice);

                    const child = await createChild(parent.data.data.id, color.productName, size.productEAN, price, [productColorOption, productSizeOption], headers);

                    for (let i = 0; i < color.productImages.length; i++) {
                        console.log(`Creating media for: ${color.productName}`);
                        const imageSrc = color.productImages[i];
                        const createdMedia = await upsertMedia(`${color.productName} ${i}`, imageSrc, headers);

                        const productMedia = await axios.post(`${BASE_URL}/product-media?_response=true`,
                            {
                                productId: child.data.data.id,
                                mediaId: createdMedia.data.data.id,
                            }, {headers});

                        // Set cover image for the product
                        await axios.patch(`${BASE_URL}/product/${child.data.data.id}?_response=true`,
                            {
                                coverId: productMedia.data.data.id,
                            }, {headers});
                    }
                }
            }
        } catch (e: any) {
            console.error(e.toString());
        }
        console.log(`Finished processing product: ${product.productColors[0].productName}`);
    }
})();

