export interface MediaRow {
    id? : Number,
    path: String,
    expire: Number
}

export interface UserRow {
    id? : Number,
    username: String,
    hashed_password: any,
    salt: any
}