export interface Product {
    brand: string;
    productName: string;
    productUrl: string;
    productPrice: string;
    availableSizes: Size[];
    chosenColor: string;
    productCategories: string[];
    productImages: string[];
    productDescription: string;
}

export interface Size {
    productEAN: string;
    sizePrice: string;
    recommendedPrice: string;
    skuValue: string;
    stockMain: string;
    stockAdditional: string;
    sizeValue: string;
}
