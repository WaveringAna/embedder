/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface User {
      username: string;
      id?: string;
    }
  }
}
/**Splits a file name into its name and then its extension */
export function extension(str: string){
  const file = str.split("/").pop();
  return [file.substr(0,file.lastIndexOf(".")),file.substr(file.lastIndexOf("."),file.length).toLowerCase()];
}
/**Type for user data */
export interface User {
  username: string;
  id?: string;
}