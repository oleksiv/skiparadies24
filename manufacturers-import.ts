import axios, {AxiosResponse} from 'axios';
import * as fs from "fs";
import * as crypto from 'crypto';

(async () => {
    const fileContent = fs.readFileSync('manufacturers.json').toString();
    const manufacturers: { name: string, image: string }[] = JSON.parse(fileContent);

    const authenticationToken = await requestAuthenticationToken();
    const requestHeaders = {
        'Authorization': `Bearer ${authenticationToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };

    for (let manufacturer of manufacturers) {
        await upsertManufacturer(manufacturer.name, manufacturer.image, requestHeaders);
    }
})();

async function requestAuthenticationToken(): Promise<string> {
    console.log("Requesting authentication token...");
    const response: AxiosResponse<any, any> = await axios.post('https://www.skiparadies24.de/api/oauth/token', {
        "client_id": "administration",
        "grant_type": "password",
        "scopes": "write",
        "username": "admin",
        "password": "HKL43lL\"!4!"
    });

    console.log("Authentication successful.");
    return response.data.access_token;
}

async function upsertManufacturer(manufacturerName: string, imageUrl: string, headers: any) {
    const hashedManufacturerId = crypto.createHash('md5').update(manufacturerName).digest('hex');

    try {
        const existingManufacturer = await axios.get(`https://www.skiparadies24.de/api/product-manufacturer/${hashedManufacturerId}`, {headers});
        console.log(`${manufacturerName} manufacturer exists`);
        return existingManufacturer;
    } catch (error) {
        const createdMediaResponse = await upsertMedia(manufacturerName, imageUrl, headers);
        const createdManufacturerResponse = await axios.post('https://www.skiparadies24.de/api/product-manufacturer?_response=true', {
            id: hashedManufacturerId,
            name: manufacturerName,
            mediaId: createdMediaResponse.data.data.id
        }, {headers});

        console.log(`Created ${manufacturerName} manufacturer`);
        return createdManufacturerResponse;
    }
}

async function upsertMedia(mediaTitle: string, imageUrl: string, headers: any) {
    const hashedMediaId = crypto.createHash('md5').update(imageUrl).digest('hex');

    try {
        return await axios.get(`https://www.skiparadies24.de/api/media/${hashedMediaId}`, {headers});
    } catch (error) {
        const createdMediaResponse = await axios.post('https://www.skiparadies24.de/api/media?_response=true', {
            id: hashedMediaId,
            title: mediaTitle,
            mediaFolderId: '018b669100e4714b943df926718bf28e'
        }, {headers});

        await axios.post(`https://www.skiparadies24.de/api/_action/media/${createdMediaResponse.data.data.id}/upload?extension=jpg&_response=true`, {
            url: imageUrl
        }, {headers});

        return createdMediaResponse;
    }
}
