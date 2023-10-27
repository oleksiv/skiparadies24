import axios, {AxiosResponse} from 'axios';
import {uuid} from 'uuidv4';

(async () => {
    const response: AxiosResponse<any, any> = await axios.post('https://www.skiparadies24.de/api/oauth/token',
        {
            "client_id": "administration",
            "grant_type": "password",
            "scopes": "write",
            "username": "admin",
            "password": "HKL43lL\"!4!"
        })

    const auth: { access_token: string } = response.data;

    const headers = {
        'Authorization': `Bearer ${auth.access_token}`,
        'Accept': `application/json`,
        'Content-Type': `application/json`
    };

    // Create media

    const createdMedia = await axios.post('https://www.skiparadies24.de/api/media?_response=true',
        {
            title: `Test Media ${uuid()}`
        }, {headers}
    );

    const createdMediaId = createdMedia.data.data.id;


    await axios.post(`https://www.skiparadies24.de/api/_action/media/${createdMediaId}/upload?extension=jpg&_response=true`,
        {
            url: `https://glisshop-glisshop-fr-storage.omn.proximis.com/Imagestorage/imagesSynchro/735/735/76170c2f333a25629609c38ee5ce5c7c47b90b71_H24VOLKSKI397716_0.jpeg`
        }, {headers}
    );


    // Create product
    const productCreated = await axios.post('https://www.skiparadies24.de/api/product?_response=true',
        {
            "stock": 10,
            "productNumber": `Product ${uuid()}`,
            "name": `Test ${uuid()}`,
            "taxId": "018b66910b6a729095cfe1cfcbd51180", // 0 percent
            "price": [
                {
                    "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                    "gross": 15,
                    "net": 10,
                    "linked": false
                }
            ],
            "variantListingConfig": {
                "configuratorGroupConfig": [
                    {
                        "id": "d1f3079ffea34441b0b3e3096ac4821a",
                        "representation": "box",
                        "expressionForListings": true
                    },
                    {
                        "id": "e2d24e55b56b4a4a8f808478fbd30333",
                        "representation": "box",
                        "expressionForListings": false
                    }
                ]
            },
            "children": [
                {
                    "productNumber": `Product ${uuid()}`,
                    "stock": 10,
                    "price": [
                        {
                            "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                            "gross": 20,
                            "net": 15,
                            "linked": false
                        }
                    ],
                    "options": [
                        {
                            "id": "4053fb11b4114d2cac7381c904651b6b"
                        },
                        {
                            "id": "ae821a4395f34b22b6dea9963c7406f2"
                        }
                    ]
                },
                {
                    "productNumber": `Product ${uuid()}`,
                    "stock": 10,
                    "options": [
                        {
                            "id": "ea14a701771148d6b04045f99c502829"
                        },
                        {
                            "id": "ae821a4395f34b22b6dea9963c7406f2"
                        }
                    ]
                },
                {
                    "productNumber": `Product ${uuid()}`,
                    "stock": 10,
                    "options": [
                        {
                            "id": "ea14a701771148d6b04045f99c502829"
                        },
                        {
                            "id": "0b9627a94fc2446498ec6abac0f03581"
                        }
                    ]
                },
                {
                    "productNumber": `Product ${uuid()}`,
                    "stock": 10,
                    "options": [
                        {
                            "id": "4053fb11b4114d2cac7381c904651b6b"
                        },
                        {
                            "id": "0b9627a94fc2446498ec6abac0f03581"
                        }
                    ]
                }
            ],
            "configuratorSettings": [
                {
                    "optionId": "0b9627a94fc2446498ec6abac0f03581"
                },
                {
                    "optionId": "4053fb11b4114d2cac7381c904651b6b"
                },
                {
                    "optionId": "ae821a4395f34b22b6dea9963c7406f2"
                },
                {
                    "optionId": "ea14a701771148d6b04045f99c502829"
                }
            ]
        }, {headers}
    );

    const createdProductId = productCreated.data.data.id;

    const createdProductMedia = await axios.post(`https://www.skiparadies24.de/api/product-media?_response=true`,
        {
            productId: createdProductId,
            mediaId: createdMediaId,
        }, {headers}
    );

    // Set cover image
    const updatedProduct = await axios.patch(`https://www.skiparadies24.de/api/product/${createdProductId}?_response=true`,
        {
            coverId: createdProductMedia.data.data.id,
        }, {headers}
    );


    console.log(updatedProduct.data);
})();