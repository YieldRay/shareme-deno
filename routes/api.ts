import { db } from "../index.ts";
import { Router } from "../deps.ts";

export function isNamespaceValid(str: string): boolean {
    return /^[a-zA-Z0-9]{1,16}$/.test(str);
}

const router = new Router<{
    namespace: string;
}>();

router.use("/:namespace", async (ctx, next) => {
    if (ctx.request.method !== "POST") {
        await next();
        return;
    }
    const namespace = ctx.params.namespace;
    if (namespace) {
        ctx.state.namespace = namespace;
        if (isNamespaceValid(namespace)) {
            await next();
        } else {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: Namespace is invalid, is can only contains letters and numbers`;
        }
    } else {
        ctx.response.status = 400;
        ctx.response.body = `[ShareMe]: namespace cannot be empty`;
    }
});

function notBrowser(ua: string | null): boolean {
    if (typeof ua != "string") return true;
    if (ua.startsWith("curl")) return true;
    if (ua.startsWith("Mozilla")) return false;
    if (ua.length <= 10) return true;
    return false;
}

//! For command line
router.get("/", async (ctx, next) => {
    if (!notBrowser(ctx.request.headers.get("user-agent"))) {
        await next();
        return;
    }

    ctx.response.body = `Usage:
(replace ':namespace' with a namespace you want)

$ curl ${ctx.request.url.origin}/:namespace                                             
$ curl ${ctx.request.url.origin}/:namespace -d t=any_thing_you_want_to_store`;
});

router.get("/:namespace", async (ctx, next) => {
    if (notBrowser(ctx.request.headers.get("user-agent"))) {
        const namespace = ctx.params.namespace;
        if (!namespace) {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: namespace cannot be empty`;
        }
        if (!isNamespaceValid(namespace)) {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: Namespace is invalid, it can only contains letters and numbers`;
        }
        const content = await db.get(namespace);
        ctx.response.body = content;
        return;
    } else {
        await next();
    }
});

router.post("/:namespace", async (ctx) => {
    const { namespace } = ctx.state;

    let body: ReturnType<typeof ctx.request.body>;
    let content = "";

    /**
     * No required body is matched, respond with content
     *
     * This is used for getting what the namespace contains rather than write it
     *
     * ! after calling this method, a `return` statement should follow !
     */
    async function respondWithContent() {
        const content = await db.get(namespace);
        ctx.response.body = content;
    }

    try {
        body = ctx.request.body();
    } catch {
        await respondWithContent();
        return;
    }

    switch (body.type) {
        case "form": {
            const form = await body.value;
            if (form.has("t")) content = form.get("t") as string;
            else {
                await respondWithContent();
                return;
            }
            break;
        }
        case "json": {
            const json = await body.value;
            if (typeof json.t === "string") content = json.t;
            else {
                await respondWithContent();
                return;
            }
            break;
        }
        default: {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: Bad request`;
            return;
        }
    }

    const ok = await db.set(namespace, content);

    if (ok) {
        ctx.response.status = 200;
        ctx.response.body = `[ShareMe]: Ok`;
    } else {
        ctx.response.status = 500;
        ctx.response.body = `[ShareMe]: Server failed to save data`;
    }
    return;
});

export default router;
