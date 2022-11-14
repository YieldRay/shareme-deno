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

router.get("/:namespace", async (ctx, next) => {
    if (ctx.request.headers.get("user-agent")?.startsWith("curl")) {
        const content = await db.get(ctx.state.namespace);
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
    let isBadRequest = false;

    try {
        body = ctx.request.body();
    } catch {
        //! No required body is matched, respond with content
        //? This is used for getting what the namespace contains rather than write it
        const content = await db.get(namespace);
        ctx.response.body = content;
        return;
    }

    switch (body.type) {
        case "form": {
            const form = await body.value;
            if (form.has("t")) content = form.get("t") as string;
            else isBadRequest = true;
            break;
        }
        case "json": {
            const json = await body.value;
            if (typeof json.t === "string") content = json.t;
            else isBadRequest = true;
            break;
        }
        default: {
            isBadRequest = true;
        }
    }

    if (isBadRequest) {
        ctx.response.status = 400;
        ctx.response.body = `[ShareMe]: Bad request`;
        return;
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
