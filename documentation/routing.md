# Routing

Embedder utilizes **Express** for routing and serving the app. Templating is currently with **EJS**, but there's a potential future migration to **React**. **Passport** is employed for authentication.

## Routes:

- **/** ([index.ts](../app/routes/index.ts))
    - `GET`: 
        - Unauthenticated: Serve `home.ejs`
        - Authenticated: Serve `index.ejs`
    - `POST`: Redirect to `/`

- **/login** ([auth.ts](../app/routes/auth.ts))
    - `GET`: Serve `login.ejs`
    - `POST` to `/login/password`: 
        - Success: Redirect to `/`
        - Failure: Redirect to `/login`

- **/logout** ([auth.ts](../app/routes/auth.ts))
    - `POST`: Redirect to `/`

- **/gifv** ([index.ts](../app/routes/index.ts))
    - `GET`: Serve `gifv.ejs`
    - `POST` to `/adduser`: Redirect to `/`

- **/adduser** ([adduser.ts](../app/routes/adduser.ts))
    - `GET`: Serve `adduser.ejs`

- **/sharex** ([index.ts](../app/routes/index.ts))
    - `POST`: Response is text containing path to uploaded file
