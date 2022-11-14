export interface DB {
    get(namespace: string): Promise<string>;
    set(namespace: string, content: string): Promise<boolean>;
    close?: () => void;
}
