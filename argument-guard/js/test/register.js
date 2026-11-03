// Maps the wanaku:evaluator/* imports to host-stub.js for `node --test`.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const stub = ${JSON.stringify(new URL('./host-stub.js', import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith('wanaku:evaluator/')) {
          return { url: stub, shortCircuit: true };
        }
        return next(specifier, context);
      }
    `),
);
