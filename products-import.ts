import axios, {AxiosResponse} from 'axios';
import * as fs from "fs";
import {Product} from "./models";
import * as crypto from 'crypto';
import {v4} from "uuid";

const BASE_URL = 'https://www.skiparadies24.de/api/';
const AUTH_HEADERS = {
    'Accept': `application/json`,
    'Content-Type': `application/json`
};

async function getAuthToken(): Promise<string> {
    // console.log("Requesting authentication token...");
    const response: AxiosResponse<any, any> = await axios.post(`${BASE_URL}oauth/token`, {
        "client_id": "administration",
        "grant_type": "password",
        "scopes": "write",
        "username": "admin",
        "password": "HKL43lL\"!4!"
    });
    // console.log("Authentication successful.");
    return response.data.access_token;
}

async function getRandomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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


async function getCategories(product: Product, headers: any): Promise<string[]> {
    async function upsertCategory(parentId: string | null, categoryName: string): Promise<string> {
        const categoryHash = crypto.createHash('md5').update(categoryName).digest('hex');

        try {
            const existingCategory = await axios.get(`https://www.skiparadies24.de/api/category/${categoryHash}`, {headers});
            return existingCategory.data.data.id;
        } catch (e) {
            const categoryCreated = await axios.post('https://www.skiparadies24.de/api/category?_response=true', {
                id: categoryHash,
                parentId: parentId,
                name: categoryName
            }, {headers});

            return categoryCreated.data.data.id;
        }
    }

    let parentId: string | null = null;
    const categoryIds: string[] = [];

    for (const cat of product.productCategories) {
        parentId = await upsertCategory(parentId, cat);
        categoryIds.push(parentId);
    }

    return categoryIds;
}


async function createParent(product: Product, productId: string, configuratorSettings: any[], headers: any) {
    const firstSize = product.availableSizes[0];
    const productPrice = await parsePrice(firstSize.sizePrice);


    try {
        // console.log(`Getting product ID: ${productId} - ${product.productName}`);

        const existingProduct = await axios.get(`https://www.skiparadies24.de/api/product/${productId}`, {headers});

        // console.log(`Product already exist: ${product.productName}`);

        return existingProduct;
    } catch (e) {
        const hashedManufacturerId = crypto.createHash('md5').update(product.brand).digest('hex');

        const randomNum = await getRandomNumber(50, 300);

        const categoryIds = await getCategories(product, headers);

        const parentCreated = await axios.post('https://www.skiparadies24.de/api/product?_response=true',
            {
                "id": productId,
                "stock": randomNum,
                "productNumber": productId,
                "description": product.productDescription.trim(),
                "name": product.productName,
                "ean": firstSize.productEAN,
                "manufacturerId": hashedManufacturerId,
                "taxId": "018b669100c5705d99f62820ab0514c5", // standard rate
                "categories": categoryIds.map(id => ({id})),
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

        // console.log('Assigning sales channel ');


        // assign product sales channel
        await axios.post('https://www.skiparadies24.de/api/product-visibility?_response=true',
            {
                productId: productId,
                salesChannelId: '018b6691babd709aa2d1189f1924c4d9',
                visibility: 30
            }, {headers}
        );


        let firstProductMedia = null;
        // console.log('Sales channel assigned');
        for (let i = 0; i < product.productImages.length; i++) {

            const imageSrc = product.productImages[i];

            const createdMedia = await upsertMedia(`${product.productName} ${i}`, imageSrc, headers);

            const productMedia = await axios.post(`https://www.skiparadies24.de/api/product-media?_response=true`,
                {
                    productId: parentCreated.data.data.id,
                    mediaId: createdMedia.data.data.id,
                }, {headers}
            );

            if (i === 0) {
                firstProductMedia = productMedia;
            }
        }

        if (firstProductMedia) {
            // const sizeProductId = crypto.createHash('md5').update(productEAN).digest('hex');

            // Set cover image
            await axios.patch(`https://www.skiparadies24.de/api/product/${parentCreated.data.data.id}?_response=true`,
                {
                    coverId: firstProductMedia.data.data.id,
                }, {headers}
            );


            // await axios.patch(`https://www.skiparadies24.de/api/product/${parentCreated.data.data.id}?_response=true`,
            //     {
            //         id: parentCreated.data.data.id,
            //         configuratorSettings: [
            //             {
            //                 mediaId: firstProductMedia.data.data.id
            //             }
            //         ]
            //     }, {headers}
            // );
        }

        return parentCreated;
    }
}

async function upsertProductOptions(product: { productColors: Product[] }, headers: any): Promise<{
    id: string,
    name: string,
    groupId: string,
    mediaId: string
}[]> {
    // console.log("Fetching group options...");
    const groupOptionsData = await axios.get('https://www.skiparadies24.de/api/property-group-option?limit=999', {headers});
    // console.log("Fetched group options.");

    const fetchedOptions = groupOptionsData.data.data as any[];

    const options = [];
    for (let color of product.productColors) {

        let variantCoverImage = undefined;
        if (color.productImages.length) {
            variantCoverImage = await upsertMedia(color.productName, color.productImages[0], headers);
        }

        let productColor = fetchedOptions.find(option => option.name === color.chosenColor && option.groupId === '269c7e40a54a462e884edb004c5f7bc8');

        if (!productColor) {
            const response = await axios.post('https://www.skiparadies24.de/api/property-group-option?_response=true', {
                "groupId": "269c7e40a54a462e884edb004c5f7bc8", // color
                "name": color.chosenColor
            }, {headers});

            options.push({
                id: response.data.data.id,
                name: response.data.data.name,
                groupId: response.data.data.groupId,
                mediaId: variantCoverImage ? variantCoverImage.data.data.id : null,
            });

            // console.log(`Created Color: ${productColor.name}`);
        } else {
            options.push({
                id: productColor.id,
                name: productColor.name,
                groupId: productColor.groupId,
                mediaId: variantCoverImage ? variantCoverImage.data.data.id : null,
            });
        }


        for (let size of color.availableSizes) {
            let productSize = fetchedOptions.find(option => option.name === size.sizeValue && option.groupId === '75f353b589d04bf48e8a9ab1f5422b0e');
            if (!productSize) {
                const response = await axios.post('https://www.skiparadies24.de/api/property-group-option?_response=true', {
                    "groupId": "75f353b589d04bf48e8a9ab1f5422b0e", // size
                    "name": size.sizeValue
                }, {headers});

                options.push({
                    id: response.data.data.id,
                    name: response.data.data.name,
                    groupId: response.data.data.groupId,
                });


                // console.log(`Created Size: ${productSize.name}`);
            } else {
                options.push({
                    id: productSize.id,
                    name: productSize.name,
                    groupId: productSize.groupId,
                });
                // console.log(`Size already exists: ${productSize.name}`);
            }

        }
    }

    const uniqueOptionsObject: any = {};
    for (let setting of options) {
        uniqueOptionsObject[setting.id] = setting;
    }

    return Object.values(uniqueOptionsObject) as any[];
}

async function createChild(childrenProductHash: string, parentId: string, productName: string, productEAN: string, productPrice: number, options: any[], headers: any) {
    try {
        return await axios.get(`https://www.skiparadies24.de/api/product/${childrenProductHash}`, {headers});
    } catch (e) {
        const randomNum = await getRandomNumber(50, 300);

        return await axios.post('https://www.skiparadies24.de/api/product?_response=true',
            {
                "id": childrenProductHash,
                "parentId": parentId,
                "productNumber": childrenProductHash,
                "name": productName,
                "ean": productEAN,
                "stock": randomNum,
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
    const files = fs.readdirSync('data').filter(file => file.endsWith('.json'));

    for (const filename of files) {

        console.log(`Started processing ${filename}`);

        const fileContent = fs.readFileSync(`data/${filename}`).toString();
        const data: { productColors: Product[] }[] = JSON.parse(fileContent);

        const authToken = await getAuthToken();
        const headers = {...AUTH_HEADERS, 'Authorization': `Bearer ${authToken}`};

        let i = 0;
        console.log(`${data.length} products detected`);
        for (let arr of data) {
            i++;
            if (i > 30) {
                continue;
            }
            const parentProduct = arr.productColors[0];

            console.log(`Processing product ${i}: ${arr.productColors[0].productName}`);

            const parentProductHash = crypto.createHash('md5').update(parentProduct.productUrl).digest('hex');

            const options = await upsertProductOptions(arr, headers);

            const configuratorSettings = options.map((s) => ({
                optionId: s.id,
                mediaId: s.mediaId
            }));

            const parent = await createParent(parentProduct, parentProductHash, configuratorSettings, headers);

            for (let color of arr.productColors) {

                const productColorOption = options.find(option => option.name === color.chosenColor && option.groupId === '269c7e40a54a462e884edb004c5f7bc8');

                for (let size of color.availableSizes) {
                    const productSizeOption = options.find(option => option.name === size.sizeValue && option.groupId === '75f353b589d04bf48e8a9ab1f5422b0e');
                    const price = await parsePrice(size.sizePrice);

                    const childrenProductHash =  crypto.createHash('md5').update(`${color.productUrl} - ${size.productEAN}`).digest('hex'); // generate unique children ID for every parent product.

                    const child = await createChild(childrenProductHash, parent.data.data.id, color.productName, size.productEAN, price, [{id: productColorOption!.id}, {id: productSizeOption!.id}], headers);

                    for (let i = 0; i < color.productImages.length; i++) {
                        // console.log(`Creating media for: ${color.productName}`);
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

            // console.log(`Finished processing product: ${product.productColors[0].productName}`);
        }
    }

})();

