import { NFileSystemDirectoryHandle } from "./NFileSystemDirectoryHandle.js";
import { parseUrl } from "./util.js";
import indexeddb from "./adapters/indexeddb.js";
import memory from "./adapters/memory.js";
import { FileSystemDirectoryHandle } from "./index.js";
import { normalize, sep } from "node:path";

type providerFunc = (
    url: string,
    ...optionalParams: any[]
) => FileSystemDirectoryHandle | Promise<FileSystemDirectoryHandle>;
const providersRegistry: Record<string, providerFunc> = {};

export function RegisterProvider(prefix: string, provFunc: providerFunc) {
    providersRegistry[prefix] = provFunc;
}

async function opfsProviderFunction(){
    let opfsDirHandle = await navigator.storage.getDirectory();
    return opfsDirHandle as unknown as FileSystemDirectoryHandle;
}

export async function getDirectoryHandleByURL(
    url: string,
    secretStore?: any,
    unionWrapped = true
): Promise<FileSystemDirectoryHandle> {
    //@ts-ignore
    RegisterProvider("memory", memory);
    //@ts-ignore
    RegisterProvider("indexeddb", indexeddb);

    RegisterProvider("opfs", opfsProviderFunction);


    const pUrl = parseUrl(url);
    const protocolWithColon = pUrl.protocol;
    const protocol = protocolWithColon.replaceAll(':', '');
    const provFunc = providersRegistry[protocol];

    if (provFunc) {
        let pathToProviderFunc = url;
        if (url.startsWith("node:")) {
            const urlParts = url.split("node://");
            let lastPath = urlParts[urlParts.length-1];
            pathToProviderFunc = lastPath;
        }
        const adapterHandle = await provFunc(pathToProviderFunc, secretStore);
        if (url.startsWith("nfs://") || url.startsWith("smb://")) {
            const urlParts = url.split("?");
            const pathParts = urlParts[0].split("/");
            const lastPath = pathParts.findLast((value) => value || undefined);
            // @ts-ignore
            adapterHandle.name = lastPath;
            // @ts-ignore
            adapterHandle.url = url;
        }
        if (unionWrapped) {
            return new NFileSystemDirectoryHandle(adapterHandle);
        } else {
            return adapterHandle;
        }
    } else {
        throw new Error(`url not handled: ${url}`);
    }
}
