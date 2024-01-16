import { db } from "../main.ts";
import { Router } from "oak";

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
            ctx.response.body = `[ShareMe]: namespace is invalid, is can only contain letters and numbers\n`;
        }
    } else {
        ctx.response.status = 400;
        ctx.response.body = `[ShareMe]: namespace cannot be empty\n`;
    }
});

function notBrowser(ua: string | null): boolean {
    if (typeof ua !== "string") return true;
    if (ua.startsWith("curl")) return true;
    if (ua.startsWith("Mozilla")) return false;
    if (ua.length <= 10) return true;
    return false;
}

router.get("/", async (ctx, next) => {
    if (!notBrowser(ctx.request.headers.get("user-agent"))) {
        await next();
        return;
    }

    {
        //! for command line
        const url = `${ctx.request.url.origin}/:namespace`;
        ctx.response.body = `Usage:
(replace ':namespace' with a namespace you want)

$ curl ${url}                                             
$ curl ${url} -d t=any_thing_you_want_to_store
$ echo "any_thing_you_want_to_store" | curl ${url} -H content-type:text/plain -d @-
`;
        //! end
    }
});

router.get("/:namespace", async (ctx, next) => {
    //! for command line
    if (notBrowser(ctx.request.headers.get("user-agent"))) {
        const namespace = ctx.params.namespace;
        if (!namespace) {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: namespace cannot be empty\n`;
        }
        if (!isNamespaceValid(namespace)) {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: namespace is invalid, it can only contain letters and numbers\n`;
        }
        const content = await db.get(namespace);
        //! add "\n" for command line
        ctx.response.body = content + "\n";
        return;
    } else {
        await next();
    }
});

router.post("/:namespace", async (ctx) => {
    const { namespace } = ctx.state;

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
        //! this do not add "\n"
    }

    let body: ReturnType<typeof ctx.request.body>;
    let content = "";

    try {
        body = ctx.request.body();
    } catch {
        return await respondWithContent();
    }

    // console.log(body.type);
    switch (body.type) {
        case "form": {
            const sp = await body.value;
            if (sp.has("t")) {
                content = sp.get("t")!;
            } else {
                return await respondWithContent();
            }
            break;
        }
        case "json": {
            const json = await body.value;
            if (typeof json.t === "string") {
                content = json.t;
            } else {
                return await respondWithContent();
            }
            break;
        }
        case "text": {
            content = await body.value;
            break;
        }
        default: {
            ctx.response.status = 400;
            ctx.response.body = `[ShareMe]: bad request\n`;
            return;
        }
    }

    const ok = await db.set(namespace, content);

    if (ok) {
        ctx.response.status = 200;
        ctx.response.body = `[ShareMe]: ok\n`;
    } else {
        ctx.response.status = 500;
        ctx.response.body = `[ShareMe]: server failed to save data\n`;
    }
    return;
});

export default router;
