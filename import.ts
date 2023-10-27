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
            "name": `Test ${uuid()}`,
            "productNumber": uuid(),
            "coverId": createdMediaId,
            "stock": 10,
            "taxId": "018b66910b6a729095cfe1cfcbd51180",
            "price": [
                {
                    "currencyId": "b7d2554b0ce847cd82f3ac9bd1c0dfca",
                    "gross": 15,
                    "net": 10,
                    "linked": false
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