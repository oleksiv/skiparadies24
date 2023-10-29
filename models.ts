export interface Product {
    manufacturer: string;
    title: string;
    href: string;
    price: string;
    sizes: Size[];
    color: string;
    categories: string[];
    images: string[];
    tabs: string[];
}

export interface Size {
    ean: string;
    price: string;
    uvp: string;
    sku: string;
    stock0: string;
    stock1: string;
    size: string;
}
