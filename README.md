<div style="display: flex; align-items: center;">
  <img src="./public/logo.png" alt="Koubou Logo" width="60" style="margin-right: 20px;"/>
  <h2 style="margin: 0;">Koubou (工房)</h1>
</div>

<p style="padding-top: 20px">
  A multi-tenant GPT-Image-2 workbench with server-managed model credentials.
</p>

![Koubou Demo](./demo_frame.png)

---

## How to Use it

- **Login:** Set the first admin account through environment variables.
- **Admin:** Create users, inspect usage, and configure the GPT-Image-2 API base URL and key.
- **Image Generation:** Just type any prompt in the text and submit.
- **Image Editing:** Select one or more images, then type your prompt and submit.
- **Projects:** Canvas state, uploads, generated images, and usage records are saved to SQLite and local storage.

---

## Features

- [x] Multi-tenant login with admin-managed users
- [x] Server-side GPT-Image-2 generations and edits
- [x] Encrypted model API key storage
- [x] Admin usage dashboard
- [x] Persisted projects, canvas state, uploads, and generated images
- [x] Image upload & clipboard paste
- [x] Image download (right-click)
- [x] Infinite Canvas w/ pan & zoom
- [x] Multi-image selection
- [x] Delete selected images
- [x] Resize images via drag handles

---

## Stack

- **Next.js**: Full-stack React app router and API routes.
- **Prisma + SQLite**: Local database for users, sessions, projects, assets, and usage.
- **React**: A JavaScript library for building user interfaces.
- **TypeScript**: A strongly typed superset of JavaScript.
- **Shadcn UI**: A collection of re-usable components built using Radix UI and Tailwind CSS.
- **Tailwind CSS**: A utility-first CSS framework.

---

## How to Run Locally

To get this project up and running on your local machine, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/za01br/koubou.git
    cd koubou
    ```

2.  **Install dependencies:**

    ```bash
    bun install
    ```

3.  **Configure environment:**

    ```bash
    cp .env.example .env
    ```

    Fill at least:

    ```dotenv
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=change-me
    SESSION_SECRET=replace-with-a-long-random-secret
    MODEL_CONFIG_ENCRYPTION_KEY=replace-with-another-long-random-secret
    DATABASE_URL=file:./data/koubou.db
    APP_STORAGE_DIR=./data/storage
    ```

    You can either set `GPT_IMAGE_2_BASE_URL` and `BASE_URL_API_KEY` in `.env`, or configure them later from the admin panel.

4.  **Create/update the local database:**

    ```bash
    bun run db:push
    ```

5.  **Start the development server:**

    ```bash
    bun run dev
    ```

    The application will be accessible at `http://localhost:3000`.

---

## License

Licensed under the [MIT license](https://github.com/za01br/koubou/blob/main/LICENSE).

---

## Open to Requests

If you have a feature request, bug report, or any other feedback, please open an issue.
