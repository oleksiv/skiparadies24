import axios, {AxiosResponse} from 'axios';
import {uuid} from 'uuidv4';
import * as fs from "fs";
import {Product} from "./models";

(async () => {
    const file = fs.readFileSync('data/alpin-ski.json').toString();
    const data: { productColors: Product[] }[] = JSON.parse(file);

    console.log("Requesting authentication token...");
    const response: AxiosResponse<any, any> = await axios.post('https://www.skiparadies24.de/api/oauth/token',
        {
            "client_id": "administration",
            "grant_type": "password",
            "scopes": "write",
            "username": "admin",
            "password": "HKL43lL\"!4!"
        })

    const auth: { access_token: string } = response.data;
    console.log("Authentication successful.");

    const headers = {
        'Authorization': `Bearer ${auth.access_token}`,
        'Accept': `application/json`,
        'Content-Type': `application/json`
    };

    // Create media

    async function createMedia(title: string, src: string) {
        const createdMedia = await axios.post('https://www.skiparadies24.de/api/media?_response=true',
            {
                title
            }, {headers}
        );

        await axios.post(`https://www.skiparadies24.de/api/_action/media/${createdMedia.data.data.id}/upload?extension=jpg&_response=true`,
            {
                url: src
            }, {headers}
        );

        return createdMedia;
    }

    for (let product of data) {
        console.log(`Processing product: ${product.productColors[0].productName}`);

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

        const children = [];
        for (let color of product.productColors) {

            const createdMediaIds = [];

            for (let i = 0; i < color.productImages.length; i++) {
                console.log(`Creating media for: ${color.productName}`);

                const image = color.productImages[i];

                const createdMedia = await createMedia( `${color.productName} ${i}`, image);

                createdMediaIds.push(createdMedia.data.data.id);
            }

            let productColor = options.find(option => option.name === color.chosenColor && option.groupId === '269c7e40a54a462e884edb004c5f7bc8');

            for (let size of color.availableSizes) {
                let productSize = options.find(option => option.name === size.sizeValue && option.groupId === '75f353b589d04bf48e8a9ab1f5422b0e');
                const productPrice = parsePrice(size.sizePrice);

                children.push({
                    "productNumber": uuid(),
                    "name": color.productName,
                    "ean": size.productEAN,
                    "stock": 10,
                    "price": [
                        {
                            "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                            "gross": productPrice, // ?
                            "net": productPrice, // ?
                            "linked": false
                        }
                    ],
                    "options": [
                        {
                            "id": productColor.id,
                        },
                        {
                            "id": productSize.id,
                        }
                    ]
                })
            }
        }

        if (product.productColors.length === 0) {
            console.log('no products found');
            continue;
        }

        const firstProduct = product.productColors[0];
        const firstProductPrice = parsePrice(firstProduct.availableSizes[0].sizePrice);

        console.log(`Creating product: ${firstProduct.productName}`);
        try {
            const parentCreated = await axios.post('https://www.skiparadies24.de/api/product?_response=true',
                {
                    "stock": 10,
                    "productNumber": uuid(),
                    "name": firstProduct.productName,
                    "taxId": "018b669100c5705d99f62820ab0514c5", // standard rate
                    "price": [
                        {
                            "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                            "gross": firstProductPrice, // ?
                            "net": firstProductPrice, // ?
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
                    "configuratorSettings": options.map(o => {
                        return {
                            optionId: o.id,
                        }
                    })
                }, {headers}
            );

            for (let child of children) {
                const childCreated = await axios.post('https://www.skiparadies24.de/api/product?_response=true',
                    child, {headers}
                );

                createMedia(child.)
            }

            fs.writeFileSync('data/created-product.json', JSON.stringify(parentCreated.data, null, 4));

        } catch (e: any) {
            console.log(e.toString());
        }

        console.log(`Finished processing product: ${product.productColors[0].productName}`);

        //
        // const createdProductId = productCreated.data.data.id;

        // const createdProductMedia = await axios.post(`https://www.skiparadies24.de/api/product-media?_response=true`,
        //     {
        //         productId: createdProductId,
        //         mediaId: createdMediaId,
        //     }, {headers}
        // );
        //
        // // Set cover image
        // const updatedProduct = await axios.patch(`https://www.skiparadies24.de/api/product/${createdProductId}?_response=true`,
        //     {
        //         coverId: createdProductMedia.data.data.id,
        //     }, {headers}
        // );
    }
})();

function parsePrice(price: string): number {
    // Extract the numeric portion and replace comma with a period
    const numericString = price.replace(/[^0-9,]/g, '').replace(',', '.');

    // Convert to number and multiply by 100
    return Math.round(parseFloat(numericString));
}