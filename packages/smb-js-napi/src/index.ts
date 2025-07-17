/**
 * Copyright 2025 NetApp Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    FileSystemWritableFileStream,
    FileSystemCreateWritableOptions,
    FileSystemSyncAccessHandle,
    NotFoundError,
    NFileSystemWritableFileStream,
    SyntaxError,
    PreNameCheck,
    InvalidModificationError,
    Stat,
} from "@netapplabs/fs-js";
import {
    // @ts-ignore
    SmbHandle as SMBHandle,
    // @ts-ignore
    SmbDirectoryHandle as SMBDirectoryHandle,
    // @ts-ignore
    SmbFileHandle as SMBFileHandle,
    // @ts-ignore
    SmbWritableFileStream,
} from "@netapplabs/smb-js";

declare global {
    var SMB_JS_DEBUG: boolean;
}
globalThis.SMB_JS_DEBUG = true;

export function smbDebug(msg?: any, ...optionalParams: any[]): void {
    if (globalThis.SMB_JS_DEBUG) {
        console.log(msg, ...optionalParams);
    }
}

export interface SmbHandlePermissionDescriptor {
    mode: "read" | "readwrite";
}

export class SmbHandle implements FileSystemHandle {
    protected _handle: SMBHandle;
    protected _parent?: SmbDirectoryHandle;
    protected _fullName: string;
    readonly kind: FileSystemHandleKind;
    readonly name: string;
    constructor(handle: SMBHandle, parent?: SmbDirectoryHandle) {
        const fullParentName = parent?._fullName || "";
        this._handle = handle;
        this._parent = parent;
        this._fullName = fullParentName + handle.name;
        this.kind = handle.kind;
        this.name = handle.name;
    }
    isSameEntry(other: FileSystemHandle): Promise<boolean> {
        // @ts-ignore
        return this._handle.isSameEntry((other as any)._handle);
    }
    async queryPermission(perm?: SmbHandlePermissionDescriptor): Promise<PermissionState> {
        return await this._handle.queryPermission(perm || {mode: "read"}) as PermissionState;
    }
    async requestPermission(perm: SmbHandlePermissionDescriptor): Promise<PermissionState> {
        return await this._handle.requestPermission(perm) as PermissionState;
    }
    async stat(): Promise<Stat> {
        return await this._handle.stat() as Stat;
    }
}

export class SmbDirectoryHandle extends SmbHandle implements FileSystemDirectoryHandle {
    declare readonly kind: "directory";
    [Symbol.asyncIterator]: SmbDirectoryHandle["entries"] = this.entries;
    constructor(url: string);
    constructor(dirHandle: SMBDirectoryHandle, parent?: SmbDirectoryHandle);
    constructor(param: string | SMBDirectoryHandle, parent?: SmbDirectoryHandle) {
        let dirHandle: SMBDirectoryHandle;
        if (typeof param === "string") {
            dirHandle = new SMBDirectoryHandle(param);
        } else {
            dirHandle = param as SMBDirectoryHandle;
        }
        // @ts-ignore
        super(dirHandle, parent);
        this[Symbol.asyncIterator] = this.entries;
        this.getEntries = this.values;
    }

    protected get _dirHandle(): SMBDirectoryHandle {
        // @ts-ignore
        return this._handle as SMBDirectoryHandle;
    }

    async *entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]> {
        try {
            for await (const [key, value] of this._dirHandle.entries()) {
                yield [key, value instanceof SMBDirectoryHandle ? new SmbDirectoryHandle(value as SMBDirectoryHandle, this) as FileSystemDirectoryHandle : new SmbFileHandle(value as SMBFileHandle, this) as FileSystemFileHandle];
            }
        } catch (e: any) {
            if (e?.message && typeof e.message === "string" && e.message.includes("not found")) {
                throw new NotFoundError();
            }
            throw e;
        }
    }

    async *keys(): AsyncIterableIterator<string> {
        try {
            for await (const key of this._dirHandle.keys()) {
                yield key;
            }
        } catch (e: any) {
            if (e?.message && typeof e.message === "string" && e.message.includes("not found")) {
                throw new NotFoundError();
            }
            throw e;
        }
    }

    async *values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle> {
        try {
            for await (const value of this._dirHandle.values()) {
                yield value instanceof SMBDirectoryHandle ? new SmbDirectoryHandle(value as SMBDirectoryHandle, this) as FileSystemDirectoryHandle : new SmbFileHandle(value as SMBFileHandle, this) as FileSystemFileHandle;
            }
        } catch (e: any) {
            if (e?.message && typeof e.message === "string" && e.message.includes("not found")) {
                throw new NotFoundError();
            }
            throw e;
        }
    }

    async getDirectoryHandle(
        name: string,
        options?: FileSystemGetDirectoryOptions
    ): Promise<FileSystemDirectoryHandle> {
        PreNameCheck(name);
        return new Promise(async (resolve, reject) => {
            await this._dirHandle.getDirectoryHandle(name, options && {create: !!options.create})
                // @ts-ignore
                .then((dirHandle) => resolve(new SmbDirectoryHandle(dirHandle as SMBDirectoryHandle, this)))
                // @ts-ignore
                .catch((e) => e?.message.includes("not found") ? reject(new NotFoundError()) : reject(e));
        });
    }

    async getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle> {
        PreNameCheck(name);
        return new Promise(async (resolve, reject) => {
            await this._dirHandle.getFileHandle(name, options && {create: !!options.create})
                // @ts-ignore
                .then((fileHandle) => resolve(new SmbFileHandle(fileHandle as SMBFileHandle, this)))
                // @ts-ignore
                .catch((e) => e?.message.includes("not found") ? reject(new NotFoundError()) : reject(e));
        });
    }

    async removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void> {
        PreNameCheck(name);
        try {
            return await this._dirHandle.removeEntry(name, options && {recursive: !!options.recursive});
        } catch (e: any) {
            switch (e?.message) {
                case `Directory "${name}" is not empty`:
                    throw new InvalidModificationError();
                case `Entry "${name}" not found`:
                    throw new NotFoundError();
                default:
                    throw e;
            }
        }
    }

    async resolve(possibleDescendant: FileSystemHandle): Promise<Array<string> | null> {
        // @ts-ignore
        return this._dirHandle.resolve(possibleDescendant);
    }

    /**
     * @deprecated Old property just for Chromium <=85. Use `.keys()`, `.values()`, `.entries()`, or the directory itself as an async iterable in the new API.
     */
    getEntries: SmbDirectoryHandle["values"];
}

export class SmbFileHandle extends SmbHandle implements FileSystemFileHandle {
    declare readonly kind: "file";
    constructor(fileHandle: SMBFileHandle, parentDir: SmbDirectoryHandle) {
        // @ts-ignore
        super(fileHandle, parentDir);
    }

    protected get _fileHandle(): SMBFileHandle {
        // @ts-ignore
        return this._handle as SMBFileHandle;
    }

    async getFile(): Promise<File> {
        return new Promise(async (resolve, reject) => {
            await this._fileHandle.getFile()
                .then(resolve)
                .catch((e: any) => reject(e?.name === "NotFoundError" ? new NotFoundError() : e));
        });
    }

    async createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream> {
        try {
            const fileStream = await this._fileHandle.createWritable(options && {keepExistingData: !!options.keepExistingData});
            const smbFileStream = fileStream as SmbWritableFileStream;
            if (!!options?.keepExistingData) {
                await smbFileStream.seek(0);
            } else {
                await smbFileStream.truncate(0);
            }
            return new NFileSystemWritableFileStream(new SmbSink(smbFileStream));
        } catch (e: any) {
            if (e?.message && typeof e.message === "string" && e.message.includes("not found")) {
                throw new NotFoundError();
            }
            throw e;
        }
    }

    async createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle> {
        // @ts-ignore
        return this._fileHandle.createSyncAccessHandle();
    }
}

export class SmbSink implements FileSystemWritableFileStream {
    private _fileStream: SmbWritableFileStream;
    constructor(fileStream: SmbWritableFileStream) {
        this._fileStream = fileStream;
    }

    get locked() {
        return this._fileStream.locked;
    }

    async write(data: FileSystemWriteChunkType): Promise<void> {
        try {
            return await this._fileStream.write(data as any);
        } catch (e: any) {
            switch (e?.message) {
                case "Property position of type number is required when writing object with type=\"seek\"":
                    throw new SyntaxError("seek requires a position argument");
                case "Property size of type number is required when writing object with type=\"truncate\"":
                    throw new SyntaxError("truncate requires a size argument");
                case "Property data of type object or string is required when writing object with type=\"write\"":
                    throw new SyntaxError("write requires a data argument");
                default:
                    throw e;
            }
        }
    }
    async seek(position: number): Promise<void> {
        return this._fileStream.seek(position);
    }
    async truncate(size: number): Promise<void> {
        return this._fileStream.truncate(size);
    }
    async close(): Promise<void> {
        return this._fileStream.close();
    }
    async abort(reason: string): Promise<void> {
        const anyReason = reason as any;
        // @ts-ignore
        return this._fileStream.abort(anyReason.message ? anyReason.message : reason);
    }
    getWriter(): WritableStreamDefaultWriter {
        return this._fileStream.getWriter();
    }
}

export async function smb(path: string): Promise<SmbDirectoryHandle> {
    return new SmbDirectoryHandle(path);
}
export default smb;
