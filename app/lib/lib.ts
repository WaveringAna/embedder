/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface User {
      id?: number | string;
      username: string;
      hashed_password?: Buffer;
      salt?: Buffer;
    }
  }
}
/**Splits a file name into its name and then its extension */
export function extension(str: string) {
    const file = str.split("/").pop();
    return [
        file.substr(0, file.lastIndexOf(".")),
        file.substr(file.lastIndexOf("."), file.length).toLowerCase(),
    ];
}
/**Type for user data */
export interface User {
  id?: number | string;
  username: string;
}

export interface UserRow extends User {
  salt: Buffer;
  hashed_password: Buffer;
}

export interface oembedObj {
  type: string;
  version: string;
  provider_name: string;
  provider_url: string;
  cache_age: number;
  title: string;
  html: string;
  url: string;
  width?: number;
  height?: number;
}

export const videoExtensions = [
    ".mp4",
    ".mov",
    ".avi",
    ".flv",
    ".mkv",
    ".wmv",
    ".webm",
];
export const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".svg",
    ".tiff",
    ".webp",
];