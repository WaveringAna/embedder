declare global {
  namespace Express {
    interface User {
      username: string;
      id?: string;
    }
  }
}

export function extension(str: String){
  let file = str.split("/").pop();
  return [file.substr(0,file.lastIndexOf(".")),file.substr(file.lastIndexOf("."),file.length).toLowerCase()];
}

export interface User {
  username: string;
  id?: string;
}