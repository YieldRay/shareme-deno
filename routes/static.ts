import { Router } from 'oak';

const router = new Router();

router.get('/(.*)', async (ctx) => {
	try {
		await ctx.send({
			root: `${Deno.cwd()}/public`,
			index: 'index.html',
		});
	} catch {
		ctx.response.body =
			(await Deno.open(`${Deno.cwd()}/public/index.html`, { read: true }))
				.readable;
	}
});

export default router;
