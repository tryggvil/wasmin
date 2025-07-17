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

import { FileSystemWritableFileStream, FileSystemCreateWritableOptions, FileSystemSyncAccessHandle } from "@netapplabs/fs-js";
import { SmbHandle as SMBHandle, SmbDirectoryHandle as SMBDirectoryHandle, SmbFileHandle as SMBFileHandle, SmbWritableFileStream } from "@netapplabs/smb-js";
declare global {
    var SMB_JS_DEBUG: boolean;
}
export declare function smbDebug(msg?: any, ...optionalParams: any[]): void;
export interface SmbHandlePermissionDescriptor {
    mode: "read" | "readwrite";
}
export declare class SmbHandle implements FileSystemHandle {
    protected _handle: SMBHandle;
    protected _parent?: SmbDirectoryHandle;
    protected _fullName: string;
    readonly kind: FileSystemHandleKind;
    readonly name: string;
    constructor(handle: SMBHandle, parent?: SmbDirectoryHandle);
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission(perm?: SmbHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(perm: SmbHandlePermissionDescriptor): Promise<PermissionState>;
}
export declare class SmbDirectoryHandle extends SmbHandle implements FileSystemDirectoryHandle {
    readonly kind: "directory";
    [Symbol.asyncIterator]: SmbDirectoryHandle["entries"];
    constructor(url: string);
    constructor(dirHandle: SMBDirectoryHandle, parent?: SmbDirectoryHandle);
    protected get _dirHandle(): SMBDirectoryHandle;
    entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<Array<string> | null>;
    /**
     * @deprecated Old property just for Chromium <=85. Use `.keys()`, `.values()`, `.entries()`, or the directory itself as an async iterable in the new API.
     */
    getEntries: SmbDirectoryHandle["values"];
}
export declare class SmbFileHandle extends SmbHandle implements FileSystemFileHandle {
    readonly kind: "file";
    constructor(fileHandle: SMBFileHandle, parentDir: SmbDirectoryHandle);
    protected get _fileHandle(): SMBFileHandle;
    getFile(): Promise<File>;
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}
export declare class SmbSink implements FileSystemWritableFileStream {
    private _fileStream;
    constructor(fileStream: SmbWritableFileStream);
    get locked(): any;
    write(data: FileSystemWriteChunkType): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
    close(): Promise<void>;
    abort(reason: string): Promise<void>;
    getWriter(): WritableStreamDefaultWriter;
}
export declare function smb(path: string): Promise<SmbDirectoryHandle>;
export default smb;
//# sourceMappingURL=index.d.ts.map