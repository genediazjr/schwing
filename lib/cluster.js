import Fastify from 'fastify';
import Cluster from 'cluster';
import Os from 'os';
const CLUSTER_PORTS = {};

export const Instance = async (app, opts = {}) => {
  const fastify = Fastify({
    ignoreTrailingSlash: true,
    trustProxy: true,
    logger: true
  });
  fastify.register(app, opts);
  await fastify.listen({ port: opts.port || process.env.PORT, host: '0.0.0.0' });
};

export const Worker = count => {
  for (let i = 0; i < count; i++) {
    const PORT = parseInt(process.env.PORT) + i;
    const worker = Cluster.fork({ PORT });
    CLUSTER_PORTS[worker.id] = { PORT };
  }

  Cluster.on('exit', worker => {
    console.log('worker %s died, forking again', worker.process.pid);
    const newWorker = Cluster.fork(CLUSTER_PORTS[worker.id]);
    CLUSTER_PORTS[newWorker.id] = CLUSTER_PORTS[worker.id];
  });
};

export const Server = async (app, opts) => {
  if (process.env.CLUSTER_COUNT) {
    let count = process.env.CLUSTER_COUNT;
    if (isNaN(process.env.CLUSTER_COUNT)) {
      count = Os.cpus().length;
    }
    if (Cluster.isPrimary) {
      Worker(parseInt(count));
    } else {
      Instance(app, opts).catch(err => {
        console.error(err);
        process.exit(1);
      });
    }
  } else {
    Instance(app, opts).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
};
